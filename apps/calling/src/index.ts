import "dotenv/config";
import express from "express";
import Twilio from "twilio";

const app = express();
const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const PUBLIC_URL = "https://shavonda-perkier-ruminantly.ngrok-free.dev";

app.post("/voice", (req, res) => {
  res.type("text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>test calling</Say>
    </Response>`);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  makeTestCall(); // trigger the call once the server is actually listening
});

async function makeTestCall() {
  const call = await client.calls.create({
    to: process.env.MY_TEST_PHONE_NUMBER!,
    from: process.env.TWILIO_PHONE_NUMBER!,
    url: `${PUBLIC_URL}/voice`,
  });
  console.log("Call initiated", call.sid);
}