import WebSocket from "ws"; // Ensure you have the 'ws' package installed
import express from "express";
import cors from "cors"; // Install using `npm install cors`

const app = express();
const PORT = 3002;

// Enable CORS for all routes
app.use(cors());

// Store WebSocket data to broadcast to clients
let latestOrderBookData = null;
let ws = null; // Declare ws globally

/**
 * Connects to the WebSocket server and listens for messages.
 * @param {string} url - The WebSocket URL to connect to.
 */
function fetchOrderBookData(url) {
  ws = new WebSocket(url); // Assign to global ws variable

  ws.on("open", () => {
    console.log("WebSocket connection established.");
  });

  ws.on("message", (data) => {
    try {
      const parsedData = JSON.parse(data);
      latestOrderBookData = parsedData; // Update the latest data
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed.");
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
}

// Start fetching WebSocket data
const websocketUrl = "wss://meta-test.rasa.capital/ws/orderbook/BTCUSDT";
fetchOrderBookData(websocketUrl);

// SSE endpoint to stream WebSocket data
app.get("/stream/orderbook", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Function to send data to the client
  const sendData = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send the latest data immediately upon connection
  if (latestOrderBookData) {
    sendData(latestOrderBookData);
  }

  // Set up continuous streaming at 10 FPS (every 100ms)
  const streamInterval = setInterval(() => {
    if (latestOrderBookData) {
      sendData(latestOrderBookData);
    }
  }, 100); // 100ms = 10 FPS

  // Clean up when client disconnects
  req.on("close", () => {
    console.log("Client disconnected from SSE.");
    clearInterval(streamInterval); // Stop the streaming interval
  });

  // Handle client disconnect on error
  req.on("error", () => {
    console.log("SSE connection error, cleaning up.");
    clearInterval(streamInterval);
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(
    `SSE server running on http://localhost:${PORT}/stream/orderbook`
  );
});
