import "dotenv/config";
import express from "express";
import plivo from "plivo";

const app = express();

const plivoClient = new plivo.Client(
  process.env.PLIVO_AUTH_ID!,
  process.env.PLIVO_AUTH_TOKEN!
);

const PUBLIC_URL = "https://shavonda-perkier-ruminantly.ngrok-free.dev"; // update if your ngrok URL changed

app.post("/plivo-voice", (req, res) => {
  res.type("text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Speak>Hello, this is a test call from the calling service, using Plivo.</Speak>
    </Response>`);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  makePlivoTestCall();
});

async function makePlivoTestCall() {
  const call = await plivoClient.calls.create(
    process.env.PLIVO_PHONE_NUMBER!,
    process.env.MY_TEST_PHONE_NUMBER!,
    `${PUBLIC_URL}/plivo-voice`
  );
  console.log("Plivo call initiated:", call);
}