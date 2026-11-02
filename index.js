import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

let booksCollection;
let featuresCollection;
let reviewsCollection;
let borrowsCollection;

// Connect MongoDB
async function connectToMongoDB() {
  await client.connect();

  const db = client.db('booknook');

  booksCollection = db.collection('all_books');
  featuresCollection = db.collection('featuresdata');
  reviewsCollection = db.collection('reviewsdata');
  borrowsCollection = db.collection('borrows');

  // Prevent the same user from borrowing the same book twice.
  await borrowsCollection.createIndex(
    { bookId: 1, userEmail: 1 },
    { unique: true }
  );

  console.log('MongoDB connected successfully');
}

// Root route
app.get('/', (req, res) => {
  res.send({ message: 'BookNook server is running fine' });
});



// Get all books
app.get('/books', async (req, res) => {
  try {
    const books = await booksCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.send(books);
  } catch (error) {
    console.error('Get Books Error:', error);
    res.status(500).send({ message: 'Failed to fetch books' });
  }
});


// Get books added by a specific user
app.get('/my-books', async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.status(400).send({
        message: 'User email is required',
      });
    }

    const books = await booksCollection
      .find({ 'addedBy.email': email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(books);
  } catch (error) {
    console.error('Get My Books Error:', error);
    res.status(500).send({
      message: 'Failed to fetch your books',
    });
  }
});


// Get one book by ID
app.get('/books/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check whether the ID is a valid MongoDB ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).send({
        message: 'Invalid book ID',
        receivedId: id,
      });
    }

    const book = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!book) {
      return res.status(404).send({
        message: 'Book not found',
      });
    }

    res.status(200).send(book);
  } catch (error) {
    console.error('Get book details error:', error);

    res.status(500).send({
      message: 'Failed to fetch book details',
    });
  }
});



// Add a new book
app.post('/books', async (req, res) => {
  try {
    const {
      title,
      author,
      category,
      image,
      description,
      totalCopies,
      name,
      email,
    } = req.body;

    const copies = Number(totalCopies);

    if (
      !title ||
      !author ||
      !category ||
      !image ||
      !description ||
      !name ||
      !email ||
      !Number.isInteger(copies) ||
      copies < 1
    ) {
      return res.status(400).send({
        message: 'Please provide all required book information',
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

    res.status(201).send({
      message: 'Book added successfully',
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error('Add Book Error:', error);
    res.status(500).send({
      message: 'Failed to add book',
    });
  }
});


// Update a book
app.patch('/books/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: 'Invalid book ID',
      });
    }

    const {
      title,
      author,
      category,
      image,
      description,
      totalCopies,
    } = req.body;

    const copies = Number(totalCopies);

    if (
      !title ||
      !author ||
      !category ||
      !image ||
      !description ||
      !Number.isInteger(copies) ||
      copies < 1
    ) {
      return res.status(400).send({
        message: 'Please provide valid book information',
      });
    }

    const existingBook = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!existingBook) {
      return res.status(404).send({
        message: 'Book not found',
      });
    }

    const borrowedCopies =
      existingBook.totalCopies - existingBook.availableCopies;

    if (copies < borrowedCopies) {
      return res.status(400).send({
        message: `At least ${borrowedCopies} copies are currently borrowed`,
      });
    }

    const availableCopies = copies - borrowedCopies;

    await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          title,
          author,
          category,
          image,
          description,
          totalCopies: copies,
          availableCopies,
          updatedAt: new Date(),
        },
      }
    );

    res.send({ message: 'Book updated successfully' });
  } catch (error) {
    console.error('Update Book Error:', error);
    res.status(500).send({
      message: 'Failed to update book',
    });
  }
});


// Delete a book
app.delete('/books/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: 'Invalid book ID',
      });
    }

    const bookId = new ObjectId(id);

    // Do not delete a book that is currently borrowed.
    const activeBorrow = await borrowsCollection.findOne({
      bookId,
    });

    if (activeBorrow) {
      return res.status(400).send({
        message: 'This book cannot be deleted while it is borrowed',
      });
    }

    const result = await booksCollection.deleteOne({
      _id: bookId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: 'Book not found',
      });
    }

    res.send({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Delete Book Error:', error);
    res.status(500).send({
      message: 'Failed to delete book',
    });
  }
});


// Get borrowed books for a user
app.get('/borrows', async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.status(400).send({
        message: 'User email is required',
      });
    }

    const borrows = await borrowsCollection
      .find({ userEmail: email })
      .sort({ borrowDate: -1 })
      .toArray();

    res.send(borrows);
  } catch (error) {
    console.error('Get Borrows Error:', error);
    res.status(500).send({
      message: 'Failed to fetch borrowed books',
    });
  }
});


// Borrow a book
app.post('/borrows', async (req, res) => {
  try {
    const {
      bookId,
      bookTitle,
      bookImage,
      userName,
      userEmail,
    } = req.body;

    if (!bookId || !userEmail || !userName) {
      return res.status(400).send({
        message: 'Book and user information are required',
      });
    }

    if (!ObjectId.isValid(bookId)) {
      return res.status(400).send({
        message: 'Invalid book ID',
      });
    }

    const objectBookId = new ObjectId(bookId);

    // Check for an existing borrow record.
    const existingBorrow = await borrowsCollection.findOne({
      bookId: objectBookId,
      userEmail,
    });

    if (existingBorrow) {
      return res.status(409).send({
        message: 'You have already borrowed this book!',
      });
    }

    // Atomically decrease available copies.
    const bookUpdate = await booksCollection.updateOne(
      {
        _id: objectBookId,
        availableCopies: { $gt: 0 },
      },
      {
        $inc: { availableCopies: -1 },
        $set: { updatedAt: new Date() },
      }
    );

    if (bookUpdate.modifiedCount === 0) {
      return res.status(400).send({
        message: 'This book is currently unavailable',
      });
    }

    const borrowDate = new Date();

    const returnDate = new Date(borrowDate);
    returnDate.setDate(returnDate.getDate() + 7);

    const borrowData = {
      bookId: objectBookId,
      bookTitle,
      bookImage,
      userName,
      userEmail,
      borrowDate,
      returnDate,
    };

    try {
      const result = await borrowsCollection.insertOne(borrowData);

      res.status(201).send({
        message: 'Book borrowed successfully',
        insertedId: result.insertedId,
      });
    } catch (insertError) {
      // If duplicate index rejects the insert, restore the copy.
      await booksCollection.updateOne(
        { _id: objectBookId },
        {
          $inc: { availableCopies: 1 },
          $set: { updatedAt: new Date() },
        }
      );

      if (insertError.code === 11000) {
        return res.status(409).send({
          message: 'You have already borrowed this book!',
        });
      }

      throw insertError;
    }
  } catch (error) {
    console.error('Borrow Book Error:', error);

    res.status(500).send({
      message: 'Failed to borrow book',
    });
  }
});


// Return a borrowed book
app.delete('/borrows/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: 'Invalid borrow ID',
      });
    }

    const borrowId = new ObjectId(id);

    const borrow = await borrowsCollection.findOne({
      _id: borrowId,
    });

    if (!borrow) {
      return res.status(404).send({
        message: 'Borrow record not found',
      });
    }

    const deleteResult = await borrowsCollection.deleteOne({
      _id: borrowId,
    });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).send({
        message: 'This book has already been returned',
      });
    }

    if (!ObjectId.isValid(String(borrow.bookId))) {
      await borrowsCollection.insertOne(borrow);
      return res.status(400).send({
        message: 'Invalid book ID in borrow record',
      });
    }

    const bookUpdate = await booksCollection.updateOne(
      { _id: new ObjectId(String(borrow.bookId)) },
      {
        $inc: { availableCopies: 1 },
        $set: { updatedAt: new Date() },
      }
    );

    if (bookUpdate.matchedCount === 0) {
      await borrowsCollection.insertOne(borrow);

      return res.status(404).send({
        message: 'Book not found',
      });
    }

    res.send({
      message: 'Book returned successfully',
    });
  } catch (error) {
    console.error('Return Book Error:', error);

    res.status(500).send({
      message: 'Failed to return book',
    });
  }
});


// Features data
app.get('/featuresdata', async (req, res) => {
  try {
    const features = await featuresCollection.find({}).toArray();
    res.send(features);
  } catch (error) {
    console.error('Features Error:', error);
    res.status(500).send({
      message: 'Failed to fetch features',
    });
  }
});


// Reviews data
app.get('/reviewsdata', async (req, res) => {
  try {
    const reviews = await reviewsCollection.find({}).toArray();
    res.send(reviews);
  } catch (error) {
    console.error('Reviews Error:', error);
    res.status(500).send({
      message: 'Failed to fetch reviews',
    });
  }
});

// JWT validation will added on here.


async function startServer() {
  try {
    await connectToMongoDB();

    app.listen(PORT, () => {
      console.log(`BookNook server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

startServer();

export default app;

