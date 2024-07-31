const express = require('express')
const dotenv = require('dotenv')
const { fetchTokenWithAccessCode } = require('./helper')
const cors = require('cors');
const path = require('path');

// configurations
dotenv.config()

// Boot express
const app = express()
const port = process.env.PORT || 3000

// middlewares
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname,'..', 'public')))


// Application routes
const makeIndex = require("../pages/index.html");
const makeOAuthCallback = require("../pages/oauth-callback.html");
app.get('/', (req, res) => {
	res.send(makeIndex(req, "./dist/hosted-main.min.js"));
});

app.get('/dev', (req, res) => {
	res.send(makeIndex(req, "./dist/hosted-main.js"));
});

// Atlassian Connect specific endpoints
app.get('/connect', (req, res) => {
	res.send(makeIndex(req, "./dist/connect-main.min.js"));
});
/*app.post('/installed', (req, res) => {
    console.log('install hook fired!');
    console.log(req.body);
    res.send('');
});
app.post('/uninstalled', (req, res) => {
    console.log('uninstall hook fired!');
    res.send('');
});
*/

app.get('/oauth-callback', (req, res) => {
	res.send(makeOAuthCallback(req));
});

app.get('/access-token', async (req, res) => {

    try {
        const code = req.query.code;
        const refresh = req.query.refresh;
        if(!code) throw new Error("No Access code provided");
        const {
            error,
            data: accessData,
            message
        } = await fetchTokenWithAccessCode(code, refresh);
        if(error) {
            //handle properly
            return res.status(400).json({
                error: true,
                message,
            });
        }else {
            data = accessData;
        }
        return res.json({
            error: false,
            ...data
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: true,
            message: `${error.message}`,
        });
    }
});

// Start server
app.listen(port, () => console.log(`Server is listening on port ${port}!`))

// Handle unhandled promise rejections and exceptions
process.on('unhandledRejection', (err) => {
    console.log(err)
})

process.on('uncaughtException', (err) => {
    console.log(err.message)
})
