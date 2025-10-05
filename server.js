// const express = require('express');
// const session = require('express-session');
// const bodyParser = require('body-parser');
// const path = require('path');
// const fs = require('fs');

// const app = express();
// const PORT = 3000;

// // Data file paths
// const DATA_DIR = path.join(__dirname, 'data');
// const USERS_FILE = path.join(DATA_DIR, 'users.json');
// const GAMES_FILE = path.join(DATA_DIR, 'games.json');
// const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');

// // Create data directory if it doesn't exist
// if (!fs.existsSync(DATA_DIR)) {
//   fs.mkdirSync(DATA_DIR);
// }

// // Helper functions to read/write data
// function readJSON(filepath, defaultValue = []) {
//   try {
//     if (fs.existsSync(filepath)) {
//       const data = fs.readFileSync(filepath, 'utf8');
//       return JSON.parse(data);
//     }
//   } catch (err) {
//     console.error(`Error reading ${filepath}:`, err);
//   }
//   return defaultValue;
// }

// function writeJSON(filepath, data) {
//   try {
//     fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
//   } catch (err) {
//     console.error(`Error writing ${filepath}:`, err);
//   }
// }

// // Load data from files
// let users = readJSON(USERS_FILE, []);
// let games = readJSON(GAMES_FILE, []);
// let comments = readJSON(COMMENTS_FILE, []);
// let gameIdCounter = games.length > 0 ? Math.max(...games.map(g => g.id)) + 1 : 1;

// // Middleware
// app.use(bodyParser.json({ limit: '50mb' }));
// app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
// app.use(express.static('public'));
// app.use(session({
//   secret: 'html-games-secret-key',
//   resave: false,
//   saveUninitialized: false,
//   cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
// }));
// const findUser = (username) => users.find(u => u.username === username);

// // Middleware to check authentication
// const requireAuth = (req, res, next) => {
//   if (!req.session.userId) {
//     return res.status(401).json({ error: 'Not authenticated' });
//   }
//   next();
// };

// // Routes

// // Serve main page
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// // Register
// app.post('/api/register', (req, res) => {
//   const { username, password } = req.body;
  
//   if (!username || !password) {
//     return res.status(400).json({ error: 'Username and password required' });
//   }
  
//   if (findUser(username)) {
//     return res.status(400).json({ error: 'Username already exists' });
//   }
  
//   users.push({ username, password });
//   writeJSON(USERS_FILE, users);
//   res.json({ message: 'Registration successful' });
// });

// // Login
// app.post('/api/login', (req, res) => {
//   const { username, password } = req.body;
  
//   const user = findUser(username);
//   if (!user || user.password !== password) {
//     return res.status(401).json({ error: 'Invalid credentials' });
//   }
  
//   req.session.userId = username;
//   res.json({ message: 'Login successful', username });
// });

// // Logout
// app.post('/api/logout', (req, res) => {
//   req.session.destroy();
//   res.json({ message: 'Logout successful' });
// });

// // Check session
// app.get('/api/check-session', (req, res) => {
//   if (req.session.userId) {
//     res.json({ authenticated: true, username: req.session.userId });
//   } else {
//     res.json({ authenticated: false });
//   }
// });

// // Create game
// app.post('/api/games', requireAuth, (req, res) => {
//   const { title, htmlContent } = req.body;
  
//   if (!title || !htmlContent) {
//     return res.status(400).json({ error: 'Title and HTML content required' });
//   }
  
//   const game = {
//     id: gameIdCounter++,
//     title,
//     htmlContent,
//     author: req.session.userId,
//     likes: [],
//     dislikes: [],
//     createdAt: new Date()
//   };
  
//   games.push(game);
//   writeJSON(GAMES_FILE, games);
//   res.json({ message: 'Game created successfully', gameId: game.id });
// });

// // Get all games
// app.get('/api/games', (req, res) => {
//   const gamesData = games.map(game => ({
//     id: game.id,
//     title: game.title,
//     author: game.author,
//     likesCount: game.likes.length,
//     dislikesCount: game.dislikes.length,
//     commentsCount: comments.filter(c => c.gameId === game.id).length,
//     createdAt: game.createdAt,
//     userLiked: req.session.userId ? game.likes.includes(req.session.userId) : false,
//     userDisliked: req.session.userId ? game.dislikes.includes(req.session.userId) : false
//   }));
  
//   res.json(gamesData);
// });

// // Get single game
// app.get('/api/games/:id', (req, res) => {
//   const game = games.find(g => g.id === parseInt(req.params.id));
  
//   if (!game) {
//     return res.status(404).json({ error: 'Game not found' });
//   }
  
//   res.json({
//     id: game.id,
//     title: game.title,
//     author: game.author,
//     htmlContent: game.htmlContent,
//     likesCount: game.likes.length,
//     dislikesCount: game.dislikes.length,
//     userLiked: req.session.userId ? game.likes.includes(req.session.userId) : false,
//     userDisliked: req.session.userId ? game.dislikes.includes(req.session.userId) : false
//   });
// });

// // Like game
// app.post('/api/games/:id/like', requireAuth, (req, res) => {
//   const game = games.find(g => g.id === parseInt(req.params.id));
  
//   if (!game) {
//     return res.status(404).json({ error: 'Game not found' });
//   }
  
//   const userId = req.session.userId;
//   const likeIndex = game.likes.indexOf(userId);
//   const dislikeIndex = game.dislikes.indexOf(userId);
  
//   // Remove dislike if exists
//   if (dislikeIndex > -1) {
//     game.dislikes.splice(dislikeIndex, 1);
//   }
  
//   // Toggle like
//   if (likeIndex > -1) {
//     game.likes.splice(likeIndex, 1);
//   } else {
//     game.likes.push(userId);
//   }
  
//   writeJSON(GAMES_FILE, games);
//   res.json({ 
//     likesCount: game.likes.length, 
//     dislikesCount: game.dislikes.length,
//     userLiked: game.likes.includes(userId),
//     userDisliked: false
//   });
// });

// // Dislike game
// app.post('/api/games/:id/dislike', requireAuth, (req, res) => {
//   const game = games.find(g => g.id === parseInt(req.params.id));
  
//   if (!game) {
//     return res.status(404).json({ error: 'Game not found' });
//   }
  
//   const userId = req.session.userId;
//   const likeIndex = game.likes.indexOf(userId);
//   const dislikeIndex = game.dislikes.indexOf(userId);
  
//   // Remove like if exists
//   if (likeIndex > -1) {
//     game.likes.splice(likeIndex, 1);
//   }
  
//   // Toggle dislike
//   if (dislikeIndex > -1) {
//     game.dislikes.splice(dislikeIndex, 1);
//   } else {
//     game.dislikes.push(userId);
//   }
  
//   writeJSON(GAMES_FILE, games);
//   res.json({ 
//     likesCount: game.likes.length, 
//     dislikesCount: game.dislikes.length,
//     userLiked: false,
//     userDisliked: game.dislikes.includes(userId)
//   });
// });

// // Get comments for a game
// app.get('/api/games/:id/comments', (req, res) => {
//   const gameComments = comments
//     .filter(c => c.gameId === parseInt(req.params.id))
//     .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
//   res.json(gameComments);
// });

// // Add comment
// app.post('/api/games/:id/comments', requireAuth, (req, res) => {
//   const { text } = req.body;
  
//   if (!text) {
//     return res.status(400).json({ error: 'Comment text required' });
//   }
  
//   const game = games.find(g => g.id === parseInt(req.params.id));
//   if (!game) {
//     return res.status(404).json({ error: 'Game not found' });
//   }
  
//   const comment = {
//     id: comments.length + 1,
//     gameId: parseInt(req.params.id),
//     author: req.session.userId,
//     text,
//     createdAt: new Date()
//   };
  
//   comments.push(comment);
//   writeJSON(COMMENTS_FILE, comments);
//   res.json(comment);
// });

// // Play game in standalone page
// app.get('/play/:id', (req, res) => {
//   const game = games.find(g => g.id === parseInt(req.params.id));
  
//   if (!game) {
//     return res.status(404).send('<h1>Game not found</h1>');
//   }
  
//   res.send(game.htmlContent);
// });

// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });


const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ggeducationlet_db_user:YiECfSeedNnQzJxR@cluster0.shp7qzn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'html_games_platform';

let db;
let usersCollection;
let gamesCollection;
let commentsCollection;

// Connect to MongoDB
async function connectToDatabase() {
  try {
    const client = await MongoClient.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
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
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use(session({
  secret: 'html-games-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
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
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Check if user already exists
    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Create new user
    await usersCollection.insertOne({ 
      username, 
      password,
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
    
    const user = await usersCollection.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.userId = username;
    res.json({ message: 'Login successful', username });
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
  if (req.session.userId) {
    res.json({ authenticated: true, username: req.session.userId });
  } else {
    res.json({ authenticated: false });
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
      .sort({ createdAt: -1 })
      .toArray();
    
    const gamesData = await Promise.all(games.map(async (game) => {
      const commentsCount = await commentsCollection.countDocuments({ 
        gameId: game._id.toString() 
      });
      
      return {
        id: game._id.toString(),
        title: game.title,
        author: game.author,
        likesCount: game.likes.length,
        dislikesCount: game.dislikes.length,
        commentsCount,
        createdAt: game.createdAt,
        userLiked: req.session.userId ? game.likes.includes(req.session.userId) : false,
        userDisliked: req.session.userId ? game.dislikes.includes(req.session.userId) : false
      };
    }));
    
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
    
    res.json({
      id: game._id.toString(),
      title: game.title,
      author: game.author,
      htmlContent: game.htmlContent,
      likesCount: game.likes.length,
      dislikesCount: game.dislikes.length,
      userLiked: req.session.userId ? game.likes.includes(req.session.userId) : false,
      userDisliked: req.session.userId ? game.dislikes.includes(req.session.userId) : false
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

// Start server after connecting to database
connectToDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});