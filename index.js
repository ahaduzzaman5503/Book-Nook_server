
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);
let booksCollection;
async function connectToMongoDB() {
    try {
        await client.connect();
        const db = client.db('booknook');
        booksCollection = db.collection('all_books');
        console.log('Successfully connected to MongoDB!');
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
}

// Root API
app.get('/', (req, res) => {
    res.send({
        mes: 'BookNook server is running fine'
    });
});

// Get all books
app.get('/all_books', async (req, res) => {
    try {
        const books = await booksCollection.find({}).toArray();

        res.status(200).json(books);
    } catch (error) {
        console.error('Error fetching books:', error);

        res.status(500).json({
            message: 'Failed to fetch books'
        });
    }
});

// Start server after MongoDB connection
async function startServer() {
    await connectToMongoDB();

    app.listen(PORT, () => {
        console.log(`BookNook server is running at ${PORT}`);
    });
}

startServer();


