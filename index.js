const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, Timestamp, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1yjndj5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("apartmentDB").collection("users");
    const apartmentCollection = client.db("apartmentDB").collection("apartmentData");
    const agreementCartCollection = client.db("apartmentDB").collection("agreementCarts");
    const announcementCartCollection = client.db("apartmentDB").collection("announcements");

    // user related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      // insert email if user doesn't exists:
      // you can do this many ways ()
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // get single user info
    app.get("/users/:email", async (req, res) => {
      const { email } = req.params;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    // get all users data from db
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    // update a user role
    app.patch('/users/update/:email', async(req, res) =>{
      const email = req.params.email
      const user = req.body
      const query = { email }
      const updateDoc = {
        $set: {...user, Timestamp: Date.now() }
      }
      const result = await usersCollection.updateOne(query, updateDoc)
      res.send(result)
    })



    // Make Announcement //
    // save a announcement data in db
    app.post('/announcement', async (req, res) => {
      const announcementData = req.body
      const result = await announcementCartCollection.insertOne(announcementData)
      res.send(result)
    })

    app.get("/apartmentData", async (req, res) => {
      const result = await apartmentCollection.find().toArray();
      res.send(result);
    });

    // Agreement Carts Collection
    app.get("/agreementCarts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await agreementCartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/agreementCarts", async (req, res) => {
      const cartItem = req.body;
      const result = await agreementCartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.delete('/agreementCarts/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await agreementCartCollection.deleteOne(query);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Building Management Server is Running");
});

app.listen(port, () => {
  console.log(`Building management is sitting on port ${port}`);
});
