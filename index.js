const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
var admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 2200;
// middleware
app.use(cors());
app.use(express.json());
//firebase
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf-8"
);
var serviceAccount = JSON.parse(decoded);
// var serviceAccount = require("./firebase-admin-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster21.x54inhf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster21`;

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
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const db = client.db("activeClub");
    const courtsCollection = db.collection("courts");
    const usersCollection = db.collection("users");
    const paymentsCollection = db.collection("payments");
    const bookingsCollection = db.collection("bookings");
    const couponsCollection = db.collection("coupons");
    const announcementCollection = db.collection("announcements");

    //verify token
    const verifyToken = async (req, res, next) => {
      const token = req.headers.authorization?.split(" ")[1];
      // console.log(token);
      if (!token) return res.status(401).send("Unauthorized");

      try {
        // verify
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded = decoded;
        next();
      } catch (error) {
        return res.status(403).send({ message: "Invalid token" });
      }
    };

    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const decoded = req.decoded?.email; // if using JWT-based auth

      const user = await usersCollection.findOne({ decoded });
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden: Admins only" });
      }
      next();
    };

    // === 1. GET all courts (sorted by createdAt descending) ===
    app.get("/courts", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const courts = await courtsCollection
          .find({})
          .sort({ created_at: -1 }) // Descending sort
          .toArray();

        res.send(courts);
      } catch (error) {
        console.error("Fetch all courts error:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });

    // === 2. GET single court by ID ===
    // app.get("/courts/:id", async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     const court = await courtsCollection.findOne({ _id: new ObjectId(id) });

    //     if (!court) {
    //       return res.status(404).send({ message: "Court not found" });
    //     }

    //     res.send(court);
    //   } catch (error) {
    //     console.error("Fetch court by ID error:", error);
    //     res.status(500).send({ message: "Internal server error", error });
    //   }
    // });

    // ===3. COURT POST API ===
    app.post("/courts", async (req, res) => {
      try {
        const courtData = req.body;
        // courtData.createdAt = new Date().toISOString();

        const result = await courtsCollection.insertOne(courtData);
        res.status(201).send({
          message: "Court added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Court insert error:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });

    // === 4. DELETE court by ID ===
    app.delete("/courts/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await courtsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Court not found to delete" });
        }

        res.send(result);
      } catch (error) {
        console.error("Delete court error:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });

    // === 5. UPDATE court by ID ===
    app.put("/courts/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        const updateDoc = {
          $set: updatedData,
        };

        const result = await courtsCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Court not found to update" });
        }

        res.send(result);
      } catch (error) {
        console.error("Update court error:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });

    //users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Booking fetch error:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });
    // GET /users/members?name=elora
    app.get("/users/members", verifyToken, verifyAdmin, async (req, res) => {
      try {
        let query = { role: "member" };
        const members = await usersCollection.find(query).toArray();
        res.send(members);
      } catch (error) {
        console.error("Error fetching members:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });

    // GET /users/role/:email
    app.get( "/users/role/:email", verifyToken, async (req, res) => {
        const email = req.params.email;

        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ role: null });
        }

        res.send({ role: user.role || "user" });
      }
    );

    app.post("/users", async (req, res) => {
      try {
        const userInfo = req.body;
        // console.log(userInfo)
        const exitUser = await usersCollection.findOne({
          email: userInfo.email,
        });
        if (exitUser) {
          // update user last login
          const lastLogin = userInfo.last_login;
          await usersCollection.updateOne(
            { email: userInfo.email },
            { $set: { last_login: lastLogin } }
          );
          return res.send(lastLogin);
        }

        const result = await usersCollection.insertOne(userInfo);
        res.status(201).send(result);
      } catch (error) {
        console.error("User creation error:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });
    // PATCH /users/role/:email
    app.patch("/users/role/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const { role } = req.body; // 'admin' or 'user'

      const result = await usersCollection.updateOne(
        { email },
        { $set: { role } }
      );

      res.send(result);
    });

    // DELETE /users/:id
    app.delete("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });

    // === GET bookings (filtered by email + pending) ===
    app.get("/bookings", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        let query = {};

        if (email) {
          query = { email, status: "pending" };
        } else {
          query = { status: "pending" };
        }

        const bookings = await bookingsCollection.find(query).toArray();
        res.send(bookings);
      } catch (error) {
        console.error("Booking fetch error:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });
    // === GET /bookings/approved?email=someone@example.com ===
    app.get("/bookings/approved",verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        const query = email
          ? { email, status: "approved" }
          : { status: "approved" };

        const bookings = await bookingsCollection.find(query).toArray();
        res.send(bookings);
      } catch (error) {
        console.error("Approved bookings fetch error:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });

    //get confirm bookings
    app.get("/bookings/confirm",verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        const query = email
          ? { email, status: "confirm" }
          : { status: "confirm" };

        const bookings = await bookingsCollection.find(query).toArray();
        res.send(bookings);
      } catch (error) {
        console.error("Approved bookings fetch error:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });

    //get all bookings with id
    app.get("/bookings/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const bookings = await bookingsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!bookings) {
        return res.status(404).send({ message: "Court not found" });
      }

      res.send(bookings);
    });

    //bookings
    app.post("/bookings", async (req, res) => {
      try {
        const bookingData = req.body;

        const result = await bookingsCollection.insertOne(bookingData);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Booking failed", error });
      }
    });
    // === PUT /bookings/:id (update status) ===
    app.put("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const { status, email } = req.body;

      const bookingFilter = { _id: new ObjectId(id) };
      const updateBooking = { $set: { status } };
      const result = await bookingsCollection.updateOne(
        bookingFilter,
        updateBooking
      );
      // If booking is approved, update the user's role to 'member'
      if (status === "approved") {
        const userFilter = { email };
        const updateUserRole = { $set: { role: "member" } };
        await usersCollection.updateOne(userFilter, updateUserRole);
      }
      res.send(result);
    });

    // === DELETE /bookings/:id ===
    app.delete("/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;
        //find the booking data
        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).send({ message: "Booking not found" });
        }
        //delete booking data from bookings api
        const bookingDeleteResult = await bookingsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        //find the court id
        // const courtId = booking.courtId;
        // let courtDeleteResult = null;
        // if (courtId) {
        //   courtDeleteResult = await courtsCollection.deleteOne({ _id: new ObjectId(courtId) });
        // }
        res.send(bookingDeleteResult);
      } catch (error) {
        console.error("Delete booking and court error:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });

    // get for payments
    app.get("/payments", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;

        let query = {};
        if (email) {
          query = { email };
        }

        const payments = await paymentsCollection.find(query).toArray();
        res.send(payments);
      } catch (error) {
        console.error("Payments fetch error:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });

    //payment
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const { booking_id } = payment;
      const filter = { _id: new ObjectId(booking_id) };
      try {
        // 1. Insert payment record
        const insertResult = await paymentsCollection.insertOne(payment);

        // 2. Update the booking's payment_status to "paid"
        const updateBooking = await bookingsCollection.updateOne(filter, {
          $set: { payments_status: "paid" },
        });
        const deleteApprovedStatus = await bookingsCollection.findOneAndUpdate(
          filter,
          { $set: { status: "confirm" } }
        );
        res.send(insertResult);
      } catch (error) {
        console.error("Error processing payment:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // POST: /create-payment-intent
    app.post("/create-payment-intent", async (req, res) => {
      const { amount } = req.body;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount, // Stripe expects amount in cents
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Stripe Payment Error:", error);
        res.status(500).send({ error: error.message });
      }
    });
    app.get("/coupons",verifyToken, verifyAdmin, async (req, res) => {
      try {
        const coupons = await couponsCollection.find().toArray();
        res.send(coupons);
      } catch (error) {
        console.error("Get coupons error:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.post("/coupons", async (req, res) => {
      try {
        const { code, discount } = req.body;

        if (!code || !discount) {
          return res
            .status(400)
            .json({ message: "Code and discount are required." });
        }

        const newCoupon = {
          code,
          discount: parseFloat(discount),
          createdAt: new Date().toISOString(),
        };

        const result = await couponsCollection.insertOne(newCoupon);
        res.send(result);
      } catch (error) {
        console.error("Add coupon error:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.patch("/coupons/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { code, discount } = req.body;

        const updateDoc = {
          $set: {
            code,
            discount: parseFloat(discount),
            updatedAt: new Date().toISOString(),
          },
        };

        const result = await couponsCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Coupon not found" });
        }

        res.send({ message: "Coupon updated successfully", result });
      } catch (error) {
        console.error("Update coupon error:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.delete("/coupons/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await couponsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Coupon not found" });
        }

        res.send({ message: "Coupon deleted successfully", result });
      } catch (error) {
        console.error("Delete coupon error:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // GET all announcements
    app.get("/announcements",verifyToken, async (req, res) => {
      try {
        const result = await announcementCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch announcements" });
      }
    });

    // POST new announcement
    app.post("/announcements", async (req, res) => {
      const newAnnouncement = req.body;
      try {
        const result = await announcementCollection.insertOne(newAnnouncement);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add announcement" });
      }
    });

    // PATCH (update) announcement
    app.patch("/announcements/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      try {
        const result = await announcementCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update announcement" });
      }
    });

    // DELETE announcement
    app.delete("/announcements/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await announcementCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete announcement" });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// sample route
app.get("/", (req, res) => {
  res.send("Active Club Server is running...");
});

// start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
