import { plivoClient } from "./client";
import { env } from "../../config/env";

export async function dialTestCall() {
  const call = await plivoClient.calls.create(
    env.plivoPhoneNumber,
    env.myTestPhoneNumber,
    `${env.publicUrl}/plivo-voice`
  );
  console.log("Plivo call initiated:", call);
  return call;
}
