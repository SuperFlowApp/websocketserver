import WebSocket from "ws"; // Ensure you have the 'ws' package installed
import express from "express";
import cors from "cors"; // Install using `npm install cors`

const app = express();
const PORT = process.env.PORT || 3002;

// Enable CORS for all routes
app.use(cors());

// Store WebSocket data to broadcast to clients
let latestOrderBookData = null;
let ws = null; // Declare ws globally
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const reconnectDelay = 5000; // 5 seconds

/**
 * Connects to the WebSocket server and listens for messages.
 * @param {string} url - The WebSocket URL to connect to.
 */
function fetchOrderBookData(url) {
  ws = new WebSocket(url); // Assign to global ws variable

  ws.on("open", () => {
    console.log("WebSocket connection established.");
    reconnectAttempts = 0; // Reset reconnect attempts on successful connection
  });

  ws.on("message", (data) => {
    try {
      const parsedData = JSON.parse(data);
      latestOrderBookData = parsedData; // Update the latest data
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`WebSocket connection closed. Code: ${code}, Reason: ${reason}`);
    attemptReconnect(url);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    attemptReconnect(url);
  });
}

/**
 * Attempts to reconnect to the WebSocket server with exponential backoff
 * @param {string} url - The WebSocket URL to reconnect to
 */
function attemptReconnect(url) {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.error(`Max reconnection attempts (${maxReconnectAttempts}) reached. Stopping reconnection.`);
    return;
  }

  reconnectAttempts++;
  const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1); // Exponential backoff
  
  console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts}) in ${delay}ms...`);
  
  setTimeout(() => {
    console.log(`Reconnecting to WebSocket... (Attempt ${reconnectAttempts})`);
    fetchOrderBookData(url);
  }, delay);
}


app.get("/stream/orderbook", (req, res) => {
  const symbol = (req.query.symbol || "BTCUSDT").toUpperCase();
  const websocketUrl = `wss://superflow.exchange/ws/orderbook/${symbol}`; // <-- FIXED

  let latestOrderBookData = null;
  let ws = new WebSocket(websocketUrl);

  ws.on("open", () => {
    console.log(`WebSocket connection established for ${symbol}`);
  });

  ws.on("message", (data) => {
    try {
      latestOrderBookData = JSON.parse(data);
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    console.log(`WebSocket closed for ${symbol}`);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendData = () => {
    if (latestOrderBookData) {
      res.write(`data: ${JSON.stringify(latestOrderBookData)}\n\n`);
    }
  };

  const streamInterval = setInterval(sendData, 100);

  req.on("close", () => {
    clearInterval(streamInterval);
    ws.close();
    console.log("Client disconnected from SSE.");
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(
    `SSE server running on http://localhost:${PORT}/stream/orderbook`
  );
});
