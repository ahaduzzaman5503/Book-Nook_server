import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";

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

// Connect to MongoDB
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
  res.status(200).json({
    message: "BookNook server is running fine",
  });
});

// GET ALL BOOKS (Newest books first)
app.get("/books", async (req, res) => {
  try {
    const books = await booksCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(books);
  } catch (error) {
    console.error("Error fetching all books:", error);

    res.status(500).json({
      message: "Failed to fetch books",
    });
  }
});

// GET MY BOOKS (Only user's added books)
app.get("/my-books", async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.status(400).json({
        message: "User email is required",
      });
    }

    const books = await booksCollection
      .find({ "addedBy.email": email })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(books);
  } catch (error) {
    console.error("Error fetching user books:", error);

    res.status(500).json({
      message: "Failed to fetch your books",
    });
  }
});

// GET SINGLE BOOK BY ID
app.get("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid book ID",
      });
    }

    const book = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!book) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    res.status(200).json(book);
  } catch (error) {
    console.error("Error fetching book:", error);

    res.status(500).json({
      message: "Failed to fetch book",
    });
  }
});

// ADD A NEW BOOK
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
      !title?.trim() ||
      !author?.trim() ||
      !category ||
      !image?.trim() ||
      !description?.trim() ||
      !name?.trim() ||
      !email?.trim()
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
      title: title.trim(),
      author: author.trim(),
      category,
      image: image.trim(),
      description: description.trim(),
      totalCopies: copies,
      availableCopies: copies,
      addedBy: {
        name: name.trim(),
        email: email.trim(),
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

// UPDATE A BOOK
app.patch("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { title, author, category, image, description, totalCopies } =
      req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid book ID",
      });
    }

    if (
      !title?.trim() ||
      !author?.trim() ||
      !category ||
      !image?.trim() ||
      !description?.trim()
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

    const existingBook = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!existingBook) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    const borrowedCopies =
      Number(existingBook.totalCopies) - Number(existingBook.availableCopies);

    if (copies < borrowedCopies) {
      return res.status(400).json({
        message: `At least ${borrowedCopies} copies are currently borrowed`,
      });
    }

    await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          title: title.trim(),
          author: author.trim(),
          category,
          image: image.trim(),
          description: description.trim(),
          totalCopies: copies,
          availableCopies: copies - borrowedCopies,
          updatedAt: new Date(),
        },
      },
    );

    res.status(200).json({
      message: "Book updated successfully",
    });
  } catch (error) {
    console.error("Error updating book:", error);

    res.status(500).json({
      message: "Failed to update book",
    });
  }
});

// DELETE A BOOK
app.delete("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid book ID",
      });
    }

    const result = await booksCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    res.status(200).json({
      message: "Book deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting book:", error);

    res.status(500).json({
      message: "Failed to delete book",
    });
  }
});

// GET ALL FEATURES
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

// GET ALL REVIEWS
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

// START SERVER AFTER DATABASE CONNECTION
async function startServer() {
  try {
    await connectToMongoDB();

    app.listen(PORT, () => {
      console.log(`BookNook server is running at ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

startServer();
