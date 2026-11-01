import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import "dotenv/config";
import { ObjectId } from 'mongodb';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);

let booksCollection;
let featuresCollection;
let reviewsCollection;

async function connectToMongoDB() {
  try {
    await client.connect();

    const db = client.db("booknook");

    booksCollection = db.collection("all_books");
    featuresCollection = db.collection("featuresdata");
    reviewsCollection = db.collection("reviewsdata");

    console.log("Successfully connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
}

// Root API
app.get("/", (req, res) => {
  res.send({
    mes: "BookNook server is running fine",
  });
});

// Get all books
app.get("/books", async (req, res) => {
  try {
    const books = await booksCollection.find({}).toArray();

    res.status(200).json(books);
  } catch (error) {
    console.error("Error fetching books:", error);

    res.status(500).json({
      message: "Failed to fetch books",
    });
  }
});

// Get all features
app.get("/featuresdata", async (req, res) => {
  try {
    const features = await featuresCollection.find({}).toArray();

    res.status(200).json(features);
  } catch (error) {
    console.error("Error fetching features:", error);

    res.status(500).json({
      message: "Failed to fetch features",
    });
  }
});

app.get("/reviewsdata", async (req, res) => {
  try {
    const reviews = await reviewsCollection.find({}).toArray();

    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);

    res.status(500).json({
      message: "Failed to fetch reviews",
    });
  }
});

// Add a new book
app.post("/books", async (req, res) => {
  try {
    const {
      title,
      author,
      category,
      image,
      description,
      name,
      email,
      totalCopies,
    } = req.body;

    if (
      !title ||
      !author ||
      !category ||
      !image ||
      !description ||
      !name ||
      !email
    ) {
      return res.status(400).json({
        message: "Please provide all required fields",
      });
    }

    const copies = Number(totalCopies);

    if (!Number.isInteger(copies) || copies < 1) {
      return res.status(400).json({
        message: "Total copies must be at least 1",
      });
    }

    const newBook = {
      title,
      author,
      category,
      image,
      description,
      totalCopies: copies,
      availableCopies: copies,
      addedBy: {
        name,
        email,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await booksCollection.insertOne(newBook);
    res.status(201).json({
      message: "Book added successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Error adding book:", error);

    res.status(500).json({
      message: "Failed to add book",
    });
  }
});

// Get a single book by ID
app.get('/books/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid book ID'
            });
        }

        const book = await booksCollection.findOne({
            _id: new ObjectId(id)
        });

        if (!book) {
            return res.status(404).json({
                message: 'Book not found'
            });
        }

        res.status(200).json(book);

    } catch (error) {
        console.error('Error fetching book:', error);

        res.status(500).json({
            message: 'Failed to fetch book'
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
