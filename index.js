const express = require('express')
const app = express()
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');

const cors = require('cors');
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xk2aa.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}

async function run() {
    try {
        await client.connect();
        console.log('db connected');
        const partsCollection = client.db('Parts_man').collection('parts');
        const orderCollection = client.db('Parts_man').collection('order');
        const userCollection = client.db('Parts_man').collection('users');


        app.get('/users', verifyJWT, async (req, res) => {
            const user = req.body;
            const result = await userCollection.find(user).toArray();
            res.send(result)
        })

        //make admin
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requestPerson = req.decoded.email;
            const requestedPersonAccount = await userCollection.findOne({ email: requestPerson });
            if (requestedPersonAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result)
            }
            else {
                res.status(403).send({ message: 'forbidden access' })
            }
        });

        //protect admin route
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isUserAdmin = user.role === 'admin';
            res.send({ admin: isUserAdmin });
        })


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            // const name = req.params.disPlayName;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            };
            const results = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            // console.log(token);
            res.send({ results, token })
        })


        app.get('/parts', async (req, res) => {
            const query = {};
            const cursor = partsCollection.find(query);
            const parts = await cursor.toArray();
            res.send(parts);
        });
        app.get('/order', verifyJWT, async (req, res) => {
            // const query = {}
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const authorization = req.headers.authorization;
                // console.log('accessToken', authorization);
                const query = { email: email }
                const result = await orderCollection.find(query).toArray();
                return res.send(result)
            }
            else {
                res.status(403).send({ message: 'forbidden access' })
            }

        })

        app.post('/order', async (req, res) => {
            const order = req.body;
            const query = { name: order.partsName, price: order.price, email: order.email }
            console.log(query);
            const exists = await orderCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, order: exists })
            }
            const result = await orderCollection.insertOne(order);
            return res.send({ success: true, result });
        })

    }
    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('car part server is running on heroku!')
})

app.listen(port, () => {
    console.log(`car daddy app listening on port ${port}`)
})