const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (required for Render)
const PORT = process.env.PORT || 3000;

// MongoDB Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb connection string here';
const DB_NAME = 'html_games_platform';

let db;
let usersCollection;
let gamesCollection;
let commentsCollection;

// Connect to MongoDB with proper options
async function connectToDatabase() {
  try {
    const client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('Connected to MongoDB successfully');
    db = client.db(DB_NAME);
    
    // Initialize collections
    usersCollection = db.collection('users');
    gamesCollection = db.collection('games');
    commentsCollection = db.collection('comments');
    
    // Create indexes for better performance
    await usersCollection.createIndex({ username: 1 }, { unique: true });
    await gamesCollection.createIndex({ createdAt: -1 });
    await commentsCollection.createIndex({ gameId: 1, createdAt: -1 });
    
    console.log('Database collections initialized');
    return client;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

// Initialize and start server
async function startServer() {
  try {
    // Connect to database first
    const client = await connectToDatabase();
    
    // Middleware
    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
    app.use(express.static('public'));
    
    // Session middleware with MongoDB store
    app.use(session({
      secret: process.env.SESSION_SECRET || 'html-games-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client: client,
        dbName: DB_NAME,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60, // 1 day
        autoRemove: 'native'
      }),
      cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: false, // Set to false for now to allow HTTP cookies
        httpOnly: true,
        sameSite: 'lax'
      }
    }));
    
    // Middleware to check authentication
    const requireAuth = (req, res, next) => {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      next();
    };
    
    // Routes
    
    // Serve main page
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    
    // Register
    app.post('/api/register', async (req, res) => {
      try {
        const { username, password, fullName, schoolName, class: className, email, phoneNumber } = req.body;
        
        if (!username || !password || !fullName || !schoolName || !className) {
          return res.status(400).json({ error: 'Username, password, full name, school name, and class are required' });
        }
        
        // Check if user already exists
        const existingUser = await usersCollection.findOne({ username });
        if (existingUser) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        
        // Create new user
        await usersCollection.insertOne({ 
          username, 
          password, // In a real app, you should hash this password
          fullName,
          schoolName,
          class: className,
          email: email || '',
          phoneNumber: phoneNumber || '',
          createdAt: new Date()
        });
        
        res.json({ message: 'Registration successful' });
      } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });
    
    // Login
    app.post('/api/login', async (req, res) => {
      try {
        const { username, password } = req.body;
        
        console.log('Login attempt for username:', username);
        
        let isAdmin = false;
        if (username === 'admin_gamer' && password === 'gamer@123') {
            isAdmin = true;
        } else {
            const user = await usersCollection.findOne({ username });
            if (!user || user.password !== password) {
              console.log('Invalid credentials for:', username);
              return res.status(401).json({ error: 'Invalid credentials' });
            }
        }
        
        req.session.userId = username;
        req.session.isAdmin = isAdmin;
        
        // Save session explicitly
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            return res.status(500).json({ error: 'Session error' });
          }
          console.log('Login successful for:', username, 'Session ID:', req.sessionID);
          res.json({ message: 'Login successful', username, isAdmin });
        });
      } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });
    
    // Logout
    app.post('/api/logout', (req, res) => {
      req.session.destroy();
      res.json({ message: 'Logout successful' });
    });
    
    // Check session
    app.get('/api/check-session', (req, res) => {
      console.log('Check session - Session ID:', req.sessionID, 'User ID:', req.session?.userId);
      if (req.session && req.session.userId) {
        res.json({ authenticated: true, username: req.session.userId, isAdmin: req.session.isAdmin || false });
      } else {
        res.json({ authenticated: false });
      }
    });

    // Get user profile
    app.get('/api/user/profile', requireAuth, async (req, res) => {
        try {
            const user = await usersCollection.findOne({ username: req.session.userId });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            // Don't send password back
            const { password, ...profile } = user;
            res.json(profile);
        } catch (err) {
            console.error('Get profile error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Update user profile
    app.put('/api/user/profile', requireAuth, async (req, res) => {
        try {
            const { fullName, schoolName, class: className, email, phoneNumber } = req.body;

            if (!fullName || !schoolName || !className) {
                return res.status(400).json({ error: 'Full name, school name, and class are required' });
            }

            const result = await usersCollection.updateOne(
                { username: req.session.userId },
                { $set: {
                    fullName,
                    schoolName,
                    class: className,
                    email: email || '',
                    phoneNumber: phoneNumber || ''
                }}
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ message: 'Profile updated successfully' });
        } catch (err) {
            console.error('Update profile error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
    
    // Create game
    app.post('/api/games', requireAuth, async (req, res) => {
      try {
        const { title, htmlContent } = req.body;
        
        if (!title || !htmlContent) {
          return res.status(400).json({ error: 'Title and HTML content required' });
        }
        
        const game = {
          title,
          htmlContent,
          author: req.session.userId,
          likes: [],
          dislikes: [],
          createdAt: new Date()
        };
        
        const result = await gamesCollection.insertOne(game);
        res.json({ 
          message: 'Game created successfully', 
          gameId: result.insertedId 
        });
      } catch (err) {
        console.error('Create game error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });
    
    // Get all games
    app.get('/api/games', async (req, res) => {
      try {
        const games = await gamesCollection
          .find({})
          .toArray();
        
        const authorUsernames = [...new Set(games.map(g => g.author))];
        const authors = await usersCollection.find({ username: { $in: authorUsernames } }).project({ password: 0 }).toArray();
        const authorMap = authors.reduce((acc, author) => {
            acc[author.username] = author;
            return acc;
        }, {});

        const gamesData = await Promise.all(games.map(async (game) => {
          const commentsCount = await commentsCollection.countDocuments({ 
            gameId: game._id.toString() 
          });
          
          const authorDetails = authorMap[game.author];

          return {
            id: game._id.toString(),
            title: game.title,
            author: authorDetails ? authorDetails.fullName : game.author,
            authorUsername: game.author,
            likesCount: game.likes.length,
            dislikesCount: game.dislikes.length,
            commentsCount,
            createdAt: game.createdAt,
            userLiked: req.session && req.session.userId ? game.likes.includes(req.session.userId) : false,
            userDisliked: req.session && req.session.userId ? game.dislikes.includes(req.session.userId) : false,
            popularity: game.likes.length - game.dislikes.length + commentsCount
          };
        }));

        gamesData.sort((a, b) => b.popularity - a.popularity);
        
        res.json(gamesData);
      } catch (err) {
        console.error('Get games error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });
    
    // Get single game
    app.get('/api/games/:id', async (req, res) => {
      try {
        const game = await gamesCollection.findOne({ 
          _id: new ObjectId(req.params.id) 
        });
        
        if (!game) {
          return res.status(404).json({ error: 'Game not found' });
        }
        
        const author = await usersCollection.findOne({ username: game.author });

        res.json({
          id: game._id.toString(),
          title: game.title,
          author: author ? author.fullName : game.author,
          authorUsername: game.author,
          authorSchool: author ? author.schoolName : '',
          authorClass: author ? author.class : '',
          htmlContent: game.htmlContent,
          likesCount: game.likes.length,
          dislikesCount: game.dislikes.length,
          userLiked: req.session && req.session.userId ? game.likes.includes(req.session.userId) : false,
          userDisliked: req.session && req.session.userId ? game.dislikes.includes(req.session.userId) : false
        });
      } catch (err) {
        console.error('Get game error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });
    
    // Like game
    app.post('/api/games/:id/like', requireAuth, async (req, res) => {
      try {
        const game = await gamesCollection.findOne({ 
          _id: new ObjectId(req.params.id) 
        });
        
        if (!game) {
          return res.status(404).json({ error: 'Game not found' });
        }
        
        const userId = req.session.userId;
        const hasLiked = game.likes.includes(userId);
        const hasDisliked = game.dislikes.includes(userId);
        
        const updateOperations = {};
        
        // Remove dislike if exists
        if (hasDisliked) {
          updateOperations.$pull = { dislikes: userId };
        }
        
        // Toggle like
        if (hasLiked) {
          updateOperations.$pull = { ...updateOperations.$pull, likes: userId };
        } else {
          updateOperations.$addToSet = { likes: userId };
          if (hasDisliked) {
            updateOperations.$pull = { dislikes: userId };
          }
        }
        
        await gamesCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          updateOperations
        );
        
        // Fetch updated game
        const updatedGame = await gamesCollection.findOne({ 
          _id: new ObjectId(req.params.id) 
        });
        
        res.json({ 
          likesCount: updatedGame.likes.length, 
          dislikesCount: updatedGame.dislikes.length,
          userLiked: updatedGame.likes.includes(userId),
          userDisliked: updatedGame.dislikes.includes(userId)
        });
      } catch (err) {
        console.error('Like game error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });
    
    // Dislike game
    app.post('/api/games/:id/dislike', requireAuth, async (req, res) => {
      try {
        const game = await gamesCollection.findOne({ 
          _id: new ObjectId(req.params.id) 
        });
        
        if (!game) {
          return res.status(404).json({ error: 'Game not found' });
        }
        
        const userId = req.session.userId;
        const hasLiked = game.likes.includes(userId);
        const hasDisliked = game.dislikes.includes(userId);
        
        const updateOperations = {};
        
        // Remove like if exists
        if (hasLiked) {
          updateOperations.$pull = { likes: userId };
        }
        
        // Toggle dislike
        if (hasDisliked) {
          updateOperations.$pull = { ...updateOperations.$pull, dislikes: userId };
        } else {
          updateOperations.$addToSet = { dislikes: userId };
          if (hasLiked) {
            updateOperations.$pull = { likes: userId };
          }
        }
        
        await gamesCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          updateOperations
        );
        
        // Fetch updated game
        const updatedGame = await gamesCollection.findOne({ 
          _id: new ObjectId(req.params.id) 
        });
        
        res.json({ 
          likesCount: updatedGame.likes.length, 
          dislikesCount: updatedGame.dislikes.length,
          userLiked: updatedGame.likes.includes(userId),
          userDisliked: updatedGame.dislikes.includes(userId)
        });
      } catch (err) {
        console.error('Dislike game error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });
    
    // Get comments for a game
    app.get('/api/games/:id/comments', async (req, res) => {
      try {
        const gameComments = await commentsCollection
          .find({ gameId: req.params.id })
          .sort({ createdAt: -1 })
          .toArray();
        
        res.json(gameComments);
      } catch (err) {
        console.error('Get comments error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });
    
    // Add comment
    app.post('/api/games/:id/comments', requireAuth, async (req, res) => {
      try {
        const { text } = req.body;
        
        if (!text) {
          return res.status(400).json({ error: 'Comment text required' });
        }
        
        const game = await gamesCollection.findOne({ 
          _id: new ObjectId(req.params.id) 
        });
        
        if (!game) {
          return res.status(404).json({ error: 'Game not found' });
        }
        
        const comment = {
          gameId: req.params.id,
          author: req.session.userId,
          text,
          createdAt: new Date()
        };
        
        const result = await commentsCollection.insertOne(comment);
        comment._id = result.insertedId;
        
        res.json(comment);
      } catch (err) {
        console.error('Add comment error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // Get user's games for profile page
    app.get('/api/my-games', requireAuth, async (req, res) => {
        try {
            let userGames;
            if (req.session.isAdmin) {
                // Admin sees all games
                userGames = await gamesCollection.find({}).sort({ createdAt: -1 }).toArray();
            } else {
                // Regular user sees their own games
                userGames = await gamesCollection.find({ author: req.session.userId }).sort({ createdAt: -1 }).toArray();
            }

            const authorUsernames = [...new Set(userGames.map(g => g.author))];
            const authors = await usersCollection.find({ username: { $in: authorUsernames } }).project({ password: 0 }).toArray();
            const authorMap = authors.reduce((acc, author) => {
                acc[author.username] = author;
                return acc;
            }, {});

            const gamesData = await Promise.all(userGames.map(async (game) => {
                const commentsCount = await commentsCollection.countDocuments({
                    gameId: game._id.toString()
                });
                const authorDetails = authorMap[game.author];
                return {
                    id: game._id.toString(),
                    title: game.title,
                    author: authorDetails ? authorDetails.fullName : game.author,
                    authorUsername: game.author,
                    likesCount: game.likes.length,
                    dislikesCount: game.dislikes.length,
                    commentsCount,
                };
            }));

            res.json(gamesData);
        } catch (err) {
            console.error('Get my-games error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Update a game
    app.put('/api/games/:id', requireAuth, async (req, res) => {
        try {
            const gameId = req.params.id;
            const { title, htmlContent } = req.body;

            if (!title || !htmlContent) {
                return res.status(400).json({ error: 'Title and HTML content are required' });
            }

            const game = await gamesCollection.findOne({
                _id: new ObjectId(gameId)
            });

            if (!game) {
                return res.status(404).json({ error: 'Game not found' });
            }

            // Check if user is author or admin
            if (game.author !== req.session.userId && !req.session.isAdmin) {
                return res.status(403).json({ error: 'You are not authorized to update this game' });
            }

            const result = await gamesCollection.updateOne(
                { _id: new ObjectId(gameId) },
                { $set: {
                    title,
                    htmlContent
                }}
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Game not found' });
            }

            res.json({ message: 'Game updated successfully' });
        } catch (err) {
            console.error('Update game error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Delete a game
    app.delete('/api/games/:id', requireAuth, async (req, res) => {
        try {
            const gameId = req.params.id;
            const game = await gamesCollection.findOne({
                _id: new ObjectId(gameId)
            });

            if (!game) {
                return res.status(404).json({ error: 'Game not found' });
            }

            // Check if user is author or admin
            if (game.author !== req.session.userId && !req.session.isAdmin) {
                return res.status(403).json({ error: 'You are not authorized to delete this game' });
            }

            // Delete game and its comments
            await gamesCollection.deleteOne({ _id: new ObjectId(gameId) });
            await commentsCollection.deleteMany({ gameId: gameId });

            res.json({ message: 'Game deleted successfully' });
        } catch (err) {
            console.error('Delete game error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
    
    // Play game in standalone page
    app.get('/play/:id', async (req, res) => {
      try {
        const game = await gamesCollection.findOne({ 
          _id: new ObjectId(req.params.id) 
        });
        
        if (!game) {
          return res.status(404).send('<h1>Game not found</h1>');
        }
        
        res.send(game.htmlContent);
      } catch (err) {
        console.error('Play game error:', err);
        res.status(500).send('<h1>Error loading game</h1>');
      }
    });
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start the server
startServer();
