import express from "express";
import cookieParser from "cookie-parser";
import { cookie_ops } from "./cookies.js";

function saveEvent() {

}

const app = express();

app.use(express.json());
app.use(cookieParser());

app.post("/api/events", (req, res) => {
    let vid = req.cookies.visitor_id;

    if (!vid) {
        vid = crypto.randomUUID();

        res.cookie("visitor_id", vid, cookie_ops);
    }


    const { event, page } = req.body;

    saveEvent({
        vid,
        event,
        page
    });

  res.json({ success: true });
});
