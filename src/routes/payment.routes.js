import express from "express";
import crypto from "crypto";
import moment from "moment";
import axios from "axios";
import { config } from "../config/zalopay.js";
import Booking from "../models/Booking.js";

const router = express.Router();

router.post("/create-payment", async (req, res) => {
  try {
    const { amount, orderId, description } = req.body;

    if (!amount || !orderId || !description) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const embeddata = {
      merchantinfo: "ZaloPay Merchant",
      redirecturl: "http://localhost:3001/MyBookings",
      orderId: orderId,
      callbackurl:
        "https://9e42-2402-800-6210-ab66-6df3-1d43-f89c-9bf0.ngrok-free.app/api/payments/callback",
    };

    const items = [
      {
        itemid: orderId,
        itemname: "Payment for order",
        itemprice: amount,
        itemquantity: 1,
      },
    ];

    const appTransId = `${moment().format("YYMMDD")}_${crypto
      .randomBytes(4)
      .toString("hex")}`;

    const order = {
      app_id: config.app_id,
      app_trans_id: appTransId,
      app_user: "user123",
      app_time: Date.now(),
      item: JSON.stringify(items),
      embed_data: JSON.stringify(embeddata),
      amount: amount,
      description: `Nội dung thanh toán: ${orderId}: ${description}`,
      bank_code: "zalopayapp",
      callback_url:
        "https://25e7-2402-800-6210-ab66-6df3-1d43-f89c-9bf0.ngrok-free.app/api/payments/callback",
    };

    const data =
      config.app_id +
      "|" +
      order.app_trans_id +
      "|" +
      order.app_user +
      "|" +
      order.amount +
      "|" +
      order.app_time +
      "|" +
      order.embed_data +
      "|" +
      order.item;
    order.mac = crypto
      .createHmac("sha256", config.key1)
      .update(data)
      .digest("hex");

    const response = await axios.post(config.endpoint, null, { params: order });

    return res.json({
      success: true,
      data: {
        order_url: response.data.order_url,
        qr_code: response.data.order_url,
        zp_trans_token: response.data.zp_trans_token,
        order_token: response.data.order_token,
        app_trans_id: appTransId,
      },
    });
  } catch (error) {
    console.error("ZaloPay payment error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment creation failed",
      error: error.message,
    });
  }
});

router.post("/callback", async (req, res) => {
  try {
    if (!req.body.data) {
      console.error("No data received in callback");
      return res.status(400).json({
        return_code: -1,
        return_message: "missing data",
      });
    }

    // Parse callback data
    const callbackData = JSON.parse(req.body.data);

    // Tính MAC theo chuẩn của ZaloPay - Sửa lại cách tính MAC
    const mac = crypto
      .createHmac("sha256", config.key2)
      .update(req.body.data)
      .digest("hex");

    if (mac !== req.body.mac) {
      console.log("MAC verification failed");
      return res.status(400).json({
        return_code: -1,
        return_message: "mac not equal",
      });
    }

    // Chỉ xử lý khi type = 1 (thanh toán thành công)
    if (req.body.type === 1) {
      try {
        // Lấy orderId từ embed_data
        const embedData = JSON.parse(callbackData.embed_data);

        const orderId = embedData.orderId;

        if (!orderId) {
          console.error("OrderId not found in embed_data");
          throw new Error("OrderId not found in callback data");
        }

        // Verify orderId format
        if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
          console.error("Invalid orderId format:", orderId);
          throw new Error("Invalid OrderId format");
        }

        // Update booking status
        const updatedBooking = await Booking.findByIdAndUpdate(
          orderId,
          {
            paymentStatus: "paid",
            updatedAt: new Date(),
            zpTransactionId: callbackData.zp_trans_id,
          },
          { new: true, runValidators: true }
        );

        if (!updatedBooking) {
          console.error("Booking not found with ID:", orderId);
          return res.json({
            return_code: 1,
            return_message: "success",
          });
        }
      } catch (error) {
        console.error("Error processing payment callback:", error);
        console.error("Error stack:", error.stack);
        return res.json({
          return_code: 1,
          return_message: "success",
        });
      }
    }

    return res.json({
      return_code: 1,
      return_message: "success",
    });
  } catch (error) {
    console.error("Payment callback error:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({
      return_code: -1,
      return_message: "internal server error",
    });
  }
});

export default router;
