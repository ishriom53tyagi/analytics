const RequestLog = require('../models/request_log');
const express = require('express');
const moment = require('moment');
const getDb = require('../utils/database').getDb;
const router = express.Router();
const checkClient = require('../utils/checkClient');
const saveIp = require('../utils/saveIp');
var dateFormat = require('dateformat');

require('dotenv').config();
const Pusher = require('pusher');
const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_APP_KEY,
    secret: process.env.PUSHER_APP_SECRET,
    cluster: process.env.PUSHER_APP_CLUSTER
});

router.use(checkClient);
router.use(saveIp);

router.use((req, res, next) => {
    if (!req.clientIp) {
        return res.status(500).send({ status: "500", message: "Internal Server Error" });;
    }
    const db = getDb();
    let requestTime = Date.now();
    let collectionName = "requestlogs" + req.clientIp + getTableName()
    res.on('finish', async () => {
        if (req.path === '/analytics') {
            return;
        }
        let obj = {
            url: req.path,
            method: req.method,
            responseTime: (Date.now() - requestTime) / 1000, // convert to seconds
            day: moment(requestTime).format("dddd"),
            hour: moment(requestTime).hour(),
            clientIp: req.clientIp
        }
        await db.collection(collectionName).insertOne(obj);
        require('../analytics_service').getAnalytics()
            .then(analytics =>
                pusher.trigger('analytics', 'updated', { analytics }),
            );
    });
    return next();
});

router.get('/wait/:seconds', async (req, res, next) => {
    await ((seconds) => {
        return new Promise(resolve => {
            setTimeout(
                () => resolve(res.send(`Waited for ${seconds} seconds`)),
                seconds * 1000
            )
        });
    })(req.params.seconds);
});

router.get('/analytics', (req, res, next) => {
    require('../analytics_service').getAnalytics()
        .then(analytics => res.render('analytics', { analytics }));
});

function getTableName() {
    var cdate = new Date();
    return dateFormat(cdate, "mmyyyy");
}


module.exports = router;