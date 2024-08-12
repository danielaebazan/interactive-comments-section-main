import fastify from 'fastify';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = fastify();

// Register plugins
app.register(cors, {
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
});

app.register(sensible);
app.register(cookie, { secret: process.env.COOKIE_SECRET });

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Helper function to handle Supabase queries
async function queryDb(promise) {
  const { data, error } = await promise;
  if (error) {
    console.error('Supabase query error:', error);
    throw new Error(error.message);
  }
  return data;
}

// Get current user ID 
async function getCurrentUserId() {
  const { data } = await supabase
    .from('User')
    .select('id')
    .eq('username', 'juliusomo')
    .single();
  return data?.id;
}

// Middleware to handle cookies
app.addHook('onRequest', async (req, res) => {
  try {
    const currentUserId = await getCurrentUserId();
    if (req.cookies.userId !== currentUserId) {
      res.clearCookie('userId');
      res.setCookie('userId', currentUserId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
      });
    }
  } catch (error) {
    console.error(`Cookie handling error: ${error.message}`);
  }
});

// List all routes (for debugging)
app.get('/routes', (req, reply) => {
  const routes = app.routes.map(route => `${route.method}:${route.url}`);
  return { routes };
});

// Test route for database connection
app.get('/test-db', async (req, res) => {
  try {
    const data = await queryDb(supabase.from('User').select('id').limit(1));
    return { success: true, data };
  } catch (error) {
    console.error('Database connection error:', error);
    return res.status(500).send({ error: 'Database connection failed', details: error.message });
  }
});

// Get all posts
app.get('/posts', async (req, res) => {
  try {
    const posts = await queryDb(supabase.from('Post').select('id, title'));
    return posts;
  } catch (error) {
    console.error(`Error fetching posts: ${error.message}`);
    return res.status(500).send({ error: 'Failed to fetch posts', details: error.message });
  }
});

// Get a single post with comments
app.get('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const post = await queryDb(supabase.from('Post').select('id, title, body').eq('id', id).single());
    
    const comments = await queryDb(supabase.from('Comment').select('id, message, createdAt, userId').eq('postId', id));
    const userIds = [...new Set(comments.map(comment => comment.userId))];
    
    const users = await queryDb(supabase.from('User').select('id, username').in('id', userIds));
    const userMap = users.reduce((acc, user) => (acc[user.id] = user, acc), {});
    
    const enhancedComments = comments.map(comment => ({
      ...comment,
      user: userMap[comment.userId],
    }));

    const userId = req.cookies.userId;
    const commentIds = comments.map(comment => comment.id);
    const likes = await queryDb(supabase.from('Like').select('commentId, userId').in('commentId', commentIds));
    const likeMap = likes.reduce((acc, like) => {
      if (!acc[like.commentId]) acc[like.commentId] = [];
      acc[like.commentId].push(like.userId);
      return acc;
    }, {});

    const finalComments = enhancedComments.map(comment => ({
      ...comment,
      likedByMe: likeMap[comment.id]?.includes(userId) || false,
      likeCount: likeMap[comment.id]?.length || 0,
    }));

    return { ...post, comments: finalComments };
  } catch (error) {
    console.error(`Error fetching post: ${error.message}`);
    return res.status(500).send({ error: 'Failed to fetch post', details: error.message });
  }
});

// Add a new comment
app.post('/posts/:id/comments', async (req, res) => {
  try {
    if (!req.body.message?.trim()) {
      return res.status(400).send({ error: 'Message is required' });
    }

    const { id } = req.params;
    const userId = req.cookies.userId;

    const newComment = await queryDb(supabase
      .from('Comment')
      .insert({ message: req.body.message, userId, parentId: req.body.parentId || null, postId: id })
      .select('id, message, parentId, createdAt, userId')
      .single());

    return { ...newComment, likeCount: 0, likedByMe: false };
  } catch (error) {
    console.error(`Error adding comment: ${error.message}`);
    return res.status(500).send({ error: 'Failed to add comment', details: error.message });
  }
});

// Update a comment
app.put('/posts/:postId/comments/:commentId', async (req, res) => {
  try {
    if (!req.body.message?.trim()) {
      return res.status(400).send({ error: 'Message is required' });
    }

    const { postId, commentId } = req.params;
    const userId = req.cookies.userId;

    const comment = await queryDb(supabase.from('Comment').select('userId').eq('id', commentId).single());

    if (comment.userId !== userId) {
      return res.status(403).send({ error: 'Unauthorized to edit this comment' });
    }

    const updatedComment = await queryDb(supabase
      .from('Comment')
      .update({ message: req.body.message })
      .eq('id', commentId)
      .select('message')
      .single());

    return updatedComment;
  } catch (error) {
    console.error(`Error updating comment: ${error.message}`);
    return res.status(500).send({ error: 'Failed to update comment', details: error.message });
  }
});

// Delete a comment
app.delete('/posts/:postId/comments/:commentId', async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.cookies.userId;

    const comment = await queryDb(supabase.from('Comment').select('userId').eq('id', commentId).single());

    if (comment.userId !== userId) {
      return res.status(403).send({ error: 'Unauthorized to delete this comment' });
    }

    const deletedComment = await queryDb(supabase
      .from('Comment')
      .delete()
      .eq('id', commentId)
      .select('id')
      .single());

    return deletedComment;
  } catch (error) {
    console.error(`Error deleting comment: ${error.message}`);
    return res.status(500).send({ error: 'Failed to delete comment', details: error.message });
  }
});

// Toggle like on a comment
app.post('/posts/:postId/comments/:commentId/toggleLike', async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.cookies.userId;

    const like = await queryDb(supabase.from('Like').select().match({ commentId, userId }).single());

    if (!like) {
      await supabase.from('Like').insert({ commentId, userId });
      return { addLike: true };
    } else {
      await supabase.from('Like').delete().match({ commentId, userId });
      return { addLike: false };
    }
  } catch (error) {
    console.error(`Error toggling like: ${error.message}`);
    return res.status(500).send({ error: 'Failed to toggle like', details: error.message });
  }
});

// Error handling
app.setErrorHandler((error, request, reply) => {
  console.error(`Unhandled error: ${error.message}`);
  reply.status(500).send({ error: 'Something went wrong', details: error.message });
});

// Start the server if not being run by Vercel
if (process.env.NODE_ENV !== 'production') {
  const start = async () => {
    try {
      await app.listen({ port: process.env.PORT || 3000 });
      console.log(`Server listening on ${app.server.address().port}`);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };
  start();
}

// Export for Vercel
export default async (req, res) => {
  await app.ready();
  app.server.emit('request', req, res);
};