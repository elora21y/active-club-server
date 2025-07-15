const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 2100;
// middleware
app.use(cors());
app.use(express.json());

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


    // === 1. GET all courts (sorted by createdAt descending) ===
    app.get("/courts", async (req, res) => {
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
    // app.delete("/courts/:id", async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     const result = await courtsCollection.deleteOne({
    //       _id: new ObjectId(id),
    //     });

    //     if (result.deletedCount === 0) {
    //       return res.status(404).send({ message: "Court not found to delete" });
    //     }

    //     res.send({ message: "Court deleted successfully" });
    //   } catch (error) {
    //     console.error("Delete court error:", error);
    //     res.status(500).send({ message: "Internal server error", error });
    //   }
    // });

    // === 5. UPDATE court by ID ===
    // app.put("/courts/:id", async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     const updatedData = req.body;

    //     const updateDoc = {
    //       $set: updatedData,
    //     };

    //     const result = await courtsCollection.updateOne(
    //       { _id: new ObjectId(id) },
    //       updateDoc
    //     );

    //     if (result.matchedCount === 0) {
    //       return res.status(404).send({ message: "Court not found to update" });
    //     }

    //     res.send({ message: "Court updated successfully" });
    //   } catch (error) {
    //     console.error("Update court error:", error);
    //     res.status(500).send({ message: "Internal server error", error });
    //   }
    // });

    //users
    // app.post("/users", async (req, res) => {
    //   try {
    //     const userInfo = req.body;

    //     const exitUser = await usersCollection.findOne({
    //       email: userInfo.email,
    //     });
    //     if (exitUser) {
    //       return res
    //         .status(400)
    //         .send({ message: "This Email is already Register" });
    //     }

    //     const result = await usersCollection.insertOne(userInfo);
    //     res.status(201).send(result);
    //   } catch (error) {
    //     console.error("User creation error:", error);
    //     res.status(500).send({ message: "Internal server error", error });
    //   }
    // });
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
