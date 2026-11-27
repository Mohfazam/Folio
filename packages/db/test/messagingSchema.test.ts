import test from "node:test";
import assert from "node:assert/strict";
import {
  messages,
  messageTemplates,
  messageThreads,
  messageDeliveryReceipts,
  messageOptOuts,
  messageChannelEnum,
  messageDirectionEnum,
  messageStatusEnum,
  messageTypeEnum,
  templateCategoryEnum,
  templateStatusEnum,
} from "../src/schema.js";

test("messaging enums export correct values", () => {
  assert.deepEqual(messageChannelEnum.enumValues, ["sms", "whatsapp"]);
  assert.deepEqual(messageDirectionEnum.enumValues, ["inbound", "outbound"]);
  assert.deepEqual(messageStatusEnum.enumValues, [
    "queued",
    "sending",
    "sent",
    "delivered",
    "undelivered",
    "failed",
    "received",
  ]);
  assert.deepEqual(messageTypeEnum.enumValues, [
    "post_call_followup",
    "campaign_outreach",
    "manual_direct",
    "system_alert",
    "inbound_reply",
  ]);
  assert.deepEqual(templateCategoryEnum.enumValues, [
    "utility",
    "marketing",
    "authentication",
    "transactional",
  ]);
  assert.deepEqual(templateStatusEnum.enumValues, [
    "draft",
    "pending_approval",
    "approved",
    "rejected",
    "disabled",
  ]);
});

test("messages table schema defines all required operational and tracking fields", () => {
  const cols = Object.keys(messages);
  assert.ok(cols.includes("id"), "messages must have id");
  assert.ok(cols.includes("clientId"), "messages must have clientId");
  assert.ok(cols.includes("contactId"), "messages must have contactId");
  assert.ok(cols.includes("callId"), "messages must have callId linking to calls table");
  assert.ok(cols.includes("threadId"), "messages must have threadId");
  assert.ok(cols.includes("templateId"), "messages must have templateId");
  assert.ok(cols.includes("channel"), "messages must have channel");
  assert.ok(cols.includes("direction"), "messages must have direction");
  assert.ok(cols.includes("status"), "messages must have status");
  assert.ok(cols.includes("fromNumber"), "messages must have fromNumber");
  assert.ok(cols.includes("toNumber"), "messages must have toNumber");
  assert.ok(cols.includes("body"), "messages must have body");
  assert.ok(cols.includes("providerMessageId"), "messages must have providerMessageId");
  assert.ok(cols.includes("cost"), "messages must have cost");
  assert.ok(cols.includes("numSegments"), "messages must have numSegments");
  assert.ok(cols.includes("createdAt"), "messages must have createdAt");
});

test("messageTemplates table schema defines template and variable fields", () => {
  const cols = Object.keys(messageTemplates);
  assert.ok(cols.includes("id"));
  assert.ok(cols.includes("clientId"));
  assert.ok(cols.includes("name"));
  assert.ok(cols.includes("channel"));
  assert.ok(cols.includes("category"));
  assert.ok(cols.includes("body"));
  assert.ok(cols.includes("sampleVariables"));
  assert.ok(cols.includes("providerTemplateId"));
});

test("messageThreads table schema defines conversation thread fields", () => {
  const cols = Object.keys(messageThreads);
  assert.ok(cols.includes("id"));
  assert.ok(cols.includes("clientId"));
  assert.ok(cols.includes("contactId"));
  assert.ok(cols.includes("customerNumber"));
  assert.ok(cols.includes("businessNumber"));
  assert.ok(cols.includes("lastMessageSnippet"));
  assert.ok(cols.includes("unreadCount"));
});

test("messageOptOuts compliance table defines required opt-out fields", () => {
  const cols = Object.keys(messageOptOuts);
  assert.ok(cols.includes("id"));
  assert.ok(cols.includes("clientId"));
  assert.ok(cols.includes("phoneNumber"));
  assert.ok(cols.includes("channel"));
  assert.ok(cols.includes("reason"));
});

test("messageDeliveryReceipts table defines provider audit fields", () => {
  const cols = Object.keys(messageDeliveryReceipts);
  assert.ok(cols.includes("id"));
  assert.ok(cols.includes("messageId"));
  assert.ok(cols.includes("provider"));
  assert.ok(cols.includes("rawStatus"));
  assert.ok(cols.includes("receivedAt"));
});
