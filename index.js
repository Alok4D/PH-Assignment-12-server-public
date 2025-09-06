const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const {
  MongoClient,
  ServerApiVersion,
  Timestamp,
  ObjectId,
} = require("mongodb");
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
    const announcementCartCollection = client
      .db("apartmentDB")
      .collection("announcements");
    const apartmentCollection = client
      .db("apartmentDB")
      .collection("apartmentData");
    const agreementCartCollection = client
      .db("apartmentDB")
      .collection("agreementCarts");
    const paymentCollection = client.db("apartmentDB").collection("payments");
    //
    const agreementViewCollection = client
      .db("apartmentDB")
      .collection("agreementView");

    // update 2025
    const membersAgreementCollection = client
      .db("apartmentDB")
      .collection("membersAgreementDetails");
    const couponsCollection = client.db("apartmentDB").collection("coupons");

    // coupons
    app.get("/coupons", async (req, res) => {
      const coupons = await couponsCollection.find().toArray();
      res.send(coupons);
    });
    //post
    app.post("/coupons", async (req, res) => {
      const coupon = req.body; // { couponCode, discount, description }
      const result = await couponsCollection.insertOne(coupon);

      if (result.insertedId) {
        res.send({ success: true, insertedId: result.insertedId });
      } else {
        res.send({ success: false });
      }
    });

    // PUT coupon availability update
    app.put("/coupons/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { available } = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { available: available },
        };

        const result = await couponsCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating coupon availability:", error);
        res
          .status(500)
          .send({ message: "Failed to update coupon availability" });
      }
    });

    // delete
    app.delete("/coupons/:id", async (req, res) => {
      const id = req.params.id;
      const result = await couponsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    // Validate coupon
    app.post("/validate-coupon", async (req, res) => {
      try {
        const { couponCode } = req.body;
        const coupon = await couponsCollection.findOne({ couponCode });

        if (!coupon) {
          return res
            .status(404)
            .send({ success: false, message: "Invalid coupon code" });
        }

        if (coupon.available === false) {
          return res
            .status(400)
            .send({ success: false, message: "Coupon not available" });
        }

        res.send({
          success: true,
          discount: coupon.discount, // e.g., 10 means 10% discount
          message: "Coupon applied successfully",
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

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
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // update a user role
    app.patch("/users/update/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email };
      const updateDoc = {
        $set: { ...user, Timestamp: Date.now() },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // member profile
    // Member Profile API
    app.get("/memberProfile/:email", async (req, res) => {
      try {
        const email = req.params.email;

        // Find user info
        const user = await usersCollection.findOne({ email });

        // Find member agreement info from membersAgreementDetails
        const memberAgreement = await membersAgreementCollection.findOne({
          email,
        });

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({
          name: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          agreementDate: memberAgreement?.agreementDate || null,
          floor: memberAgreement?.floor || null,
          block: memberAgreement?.block || null,
          room: memberAgreement?.room || null,
          rent: memberAgreement?.rent || null,
        });
      } catch (error) {
        console.error("Error fetching member profile:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Accept agreement & save in membersAgreementDetails
    app.patch("/agreement/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { email, role, status, agreementDate, floor, block, room, rent } =
          req.body;

        // 1. Update user role
        const userResult = await usersCollection.updateOne(
          { email },
          { $set: { role } },
          { upsert: true }
        );

        // 2. Update agreement request status
        const agreementResult = await agreementCartCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } },
          { upsert: true }
        );

        // 3. Insert into membersAgreementDetails
        const memberAgreement = {
          email,
          agreementDate,
          floor,
          block,
          room,
          rent,
          createdAt: new Date(),
        };
        const detailsResult = await membersAgreementCollection.insertOne(
          memberAgreement
        );

        if (userResult.modifiedCount > 0 || agreementResult.modifiedCount > 0) {
          res.send({
            success: true,
            message: "User is Member & agreement saved separately.",
          });
        } else {
          res
            .status(400)
            .send({ success: false, message: "Failed to update." });
        }
      } catch (error) {
        console.error("Error saving agreement details:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // U to Member
    app.patch("/agreement/:id", async (req, res) => {
      const { id } = req.params;
      const { email, role, status } = req.body;
      const query = {
        _id: new ObjectId(id),
      };
      const agreementResult = await agreementCartCollection.updateOne(
        query,
        { $set: { status } },
        { upsert: true }
      );
      const userResult = await usersCollection.updateOne(
        { email },
        { $set: { role } },
        { upsert: true }
      );
      if (agreementResult.modifiedCount > 0 || userResult.modifiedCount > 0) {
        res.send({ success: true });
      }
    });

    // Make Announcement //
    // save a announcement data in db
    app.post("/announcement", async (req, res) => {
      const announcementData = req.body;
      const result = await announcementCartCollection.insertOne(
        announcementData
      );
      res.send(result);
    });

    app.get("/announcement", async (req, res) => {
      const result = await announcementCartCollection.find().toArray();
      res.send(result);
    });

    // apartment db to save
    app.get("/apartmentData", async (req, res) => {
      const result = await apartmentCollection.find().toArray();
      res.send(result);
    });

    app.post("/agreementCarts", async (req, res) => {
      const cartItem = req.body;
      const result = await agreementCartCollection.insertOne(cartItem);
      res.send(result);
    });

    //
    app.get("/agreementCarts", async (req, res) => {
      const result = await agreementCartCollection.find().toArray();
      res.send(result);
    });
    //

    app.delete("/agreementCarts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await agreementCartCollection.deleteOne(query);
      res.send(result);
    });

    // get single room
    app.get("/agreementDetails/:id", async (req, res) => {
      const id = req.params.id;
      const query = { menuId: id };
      const result = await agreementCartCollection.findOne(query);
      res.send(result);
    });

    // agreement view details server api //

    app.get("/agreementView", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await agreementViewCollection.find(query).toArray();
      // console.log(result);
      res.send(result);
    });

    app.post("/agreementView", async (req, res) => {
      const agreementViewItem = req.body;
      const result = await agreementViewCollection.insertOne(agreementViewItem);
      res.send(result);
    });

    app.delete("/agreementView/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await agreementViewCollection.deleteOne(query);
      res.send(result);
      console.log(result);
    });

    //

    // payment intent system

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount inside the intent!");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payments", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    // payment related api
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      if (paymentResult.insertedId) {
        await agreementViewCollection.deleteMany({ email: payment.email });
      }

      res.send(paymentResult);
    });

    app.get("/admin-stats", async (req, res) => {
      const totalApartment = await apartmentCollection.countDocuments();
      const totalUser = await usersCollection.countDocuments({ role: "user" });
      const totalMember = await usersCollection.countDocuments({
        role: "Member",
      });
      res.send({ totalApartment, totalUser, totalMember });
    });

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
