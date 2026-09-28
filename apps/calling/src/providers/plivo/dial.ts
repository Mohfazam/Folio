import { plivoClient } from "./client.js";
import { env } from "../../config/env.js";

export async function dialTestCall() {
  const call = await plivoClient.calls.create(
    env.plivoPhoneNumber,
    env.myTestPhoneNumber,
    `${env.publicUrl}/plivo-voice`
  );
  console.log("Plivo call initiated:", call);
  return call;
}
