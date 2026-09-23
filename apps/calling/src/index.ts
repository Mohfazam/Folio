import "dotenv"
import { configDotenv } from "dotenv";
import Twilio from "twilio"

configDotenv();

const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);


async function makeTestCall() {
    const call = await client.calls.create({
        to: process.env.MY_TEST_PHONE_NUMBER!,
        from: process.env.TWILIO_PHONE_NUMBER!,
        url: "https://handler.twilio.com/twiml/EH1cc9035b975c5126e86fec68bfbca66a",
    });

    console.log("Call initiated", call.sid);
}

makeTestCall();