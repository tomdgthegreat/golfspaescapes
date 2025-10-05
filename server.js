const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// API endpoint to publish posts
app.post('/api/publish', async (req, res) => {
    try {
        const { html, publishDate, slug, title, metaDescription } = req.body;
        
        if (!html || !publishDate || !slug) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Ensure posts directory exists
        const postsDir = path.join(__dirname, 'public', 'posts');
        await fs.mkdir(postsDir, { recursive: true });
        
        // Save the HTML file directly
        const postPath = path.join(postsDir, `${slug}.html`);
        await fs.writeFile(postPath, html, 'utf8');
        
        // Update posts index for homepage
        await updatePostsIndex({
            title,
            slug,
            metaDescription,
            publishDate
        });
        
        // Regenerate sitemap
        await generateSitemap();
        
        res.json({ 
            success: true, 
            url: `/posts/${slug}.html` 
        });
    } catch (error) {
        console.error('Publish error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all posts for homepage
app.get('/api/posts', async (req, res) => {
    try {
        const postsData = await fs.readFile(
            path.join(__dirname, 'data', 'posts.json'),
            'utf8'
        );
        const posts = JSON.parse(postsData);
        res.json(posts.slice(0, 10));
    } catch (error) {
        res.json([]);
    }
});

async function updatePostsIndex(newPost) {
    const indexPath = path.join(__dirname, 'data', 'posts.json');
    let posts = [];
    
    try {
        const data = await fs.readFile(indexPath, 'utf8');
        posts = JSON.parse(data);
    } catch (error) {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    }
    
    posts = posts.filter(p => p.slug !== newPost.slug);
    
    const insertIndex = posts.findIndex(p => 
        new Date(p.publishDate) < new Date(newPost.publishDate)
    );
    
    if (insertIndex === -1) {
        posts.push(newPost);
    } else {
        posts.splice(insertIndex, 0, newPost);
    }
    
    await fs.writeFile(indexPath, JSON.stringify(posts, null, 2));
}

async function generateSitemap() {
    let posts = [];
    try {
        const postsData = await fs.readFile(
            path.join(__dirname, 'data', 'posts.json'),
            'utf8'
        );
        posts = JSON.parse(postsData);
    } catch (error) {
        // No posts yet
    }
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://golfspaescapes.com/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>`;
    
    posts.forEach(post => {
        sitemap += `
    <url>
        <loc>https://golfspaescapes.com/posts/${post.slug}.html</loc>
        <lastmod>${post.publishDate.split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>`;
    });
    
    sitemap += '\n</urlset>';
    
    await fs.writeFile(
        path.join(__dirname, 'public', 'sitemap.xml'),
        sitemap
    );
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ GolfSpaEscapes running on port ${PORT}`);
    console.log(`📝 Admin: http://localhost:${PORT}/admin/publish.html`);
});
