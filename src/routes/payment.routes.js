import express from "express";
import crypto from "crypto";
import moment from "moment";
import axios from "axios";
import { config } from "../config/zalopay.js";
import Booking from "../models/Booking.js";
import qs from "qs";
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
        "https://299e-2402-800-6210-ab66-b989-9f16-2a8a-5978.ngrok-free.app/api/payments/callback",
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
        "https://299e-2402-800-6210-ab66-b989-9f16-2a8a-5978.ngrok-free.app/api/payments/callback",
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

// router.post("/callback", async (req, res) => {
//   try {
//     if (!req.body.data) {
//       console.error("No data received in callback");
//       return res.status(400).json({
//         return_code: -1,
//         return_message: "missing data",
//       });
//     }

//     // Parse callback data
//     const callbackData = JSON.parse(req.body.data);

//     // Tính MAC theo chuẩn của ZaloPay - Sửa lại cách tính MAC
//     const mac = crypto
//       .createHmac("sha256", config.key2)
//       .update(req.body.data)
//       .digest("hex");

//     if (mac !== req.body.mac) {
//       console.log("MAC verification failed");
//       return res.status(400).json({
//         return_code: -1,
//         return_message: "mac not equal",
//       });
//     }

//     // Chỉ xử lý khi type = 1 (thanh toán thành công)
//     if (req.body.type === 1) {
//       try {
//         // Lấy orderId từ embed_data
//         const embedData = JSON.parse(callbackData.embed_data);

//         const orderId = embedData.orderId;

//         if (!orderId) {
//           console.error("OrderId not found in embed_data");
//           throw new Error("OrderId not found in callback data");
//         }

//         // Verify orderId format
//         if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
//           console.error("Invalid orderId format:", orderId);
//           throw new Error("Invalid OrderId format");
//         }

//         // Update booking status
//         const updatedBooking = await Booking.findByIdAndUpdate(
//           orderId,
//           {
//             paymentStatus: "paid",
//             updatedAt: new Date(),
//             zpTransactionId: callbackData.zp_trans_id,
//           },
//           { new: true, runValidators: true }
//         );

//         if (!updatedBooking) {
//           console.error("Booking not found with ID:", orderId);
//           return res.json({
//             return_code: 1,
//             return_message: "success",
//           });
//         }
//       } catch (error) {
//         console.error("Error processing payment callback:", error);
//         console.error("Error stack:", error.stack);
//         return res.json({
//           return_code: 1,
//           return_message: "success",
//         });
//       }
//     }

//     return res.json({
//       return_code: 1,
//       return_message: "success",
//     });
//   } catch (error) {
//     console.error("Payment callback error:", error);
//     console.error("Error stack:", error.stack);
//     return res.status(500).json({
//       return_code: -1,
//       return_message: "internal server error",
//     });
//   }
// });

// router.post("/order-status/:app_trans_id", async (req, res) => {
//   try {
//     const app_trans_id = req.params.app_trans_id;
//     const postData = {
//       app_id: config.app_id,
//       app_trans_id: app_trans_id,
//     };

//     const data =
//       postData.app_id + "|" + postData.app_trans_id + "|" + config.key1;
//     postData.mac = crypto
//       .createHmac("sha256", config.key1)
//       .update(data)
//       .digest("hex");

//     const postConfig = {
//       method: "post",
//       url: "https://sb-openapi.zalopay.vn/v2/query",
//       headers: {
//         "Content-Type": "application/x-www-form-urlencoded",
//       },
//       data: qs.stringify(postData),
//     };

//     const result = await axios(postConfig);
//     return res.status(200).json(result.data);
//   } catch (error) {
//     console.error("Error checking order status:", error.message);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to check order status",
//       error: error.message,
//     });
//   }
// });

router.post("/callback", async (req, res) => {
  try {
    if (!req.body.data) {
      console.error("No data received in callback");
      return res.status(400).json({
        return_code: -1,
        return_message: "missing data",
      });
    }

    const callbackData = JSON.parse(req.body.data);
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

    if (req.body.type === 1) {
      try {
        const embedData = JSON.parse(callbackData.embed_data);
        const orderId = embedData.orderId;

        if (!orderId) {
          console.error("OrderId not found in embed_data");
          throw new Error("OrderId not found in callback data");
        }

        if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
          console.error("Invalid orderId format:", orderId);
          throw new Error("Invalid OrderId format");
        }

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
        }
      } catch (error) {
        console.error("Error processing payment callback:", error);
        console.error("Error stack:", error.stack);
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

router.post("/order-status/:app_trans_id", async (req, res) => {
  try {
    const app_trans_id = req.params.app_trans_id;
    const postData = {
      app_id: config.app_id,
      app_trans_id: app_trans_id,
    };

    const data =
      postData.app_id + "|" + postData.app_trans_id + "|" + config.key1;
    postData.mac = crypto
      .createHmac("sha256", config.key1)
      .update(data)
      .digest("hex");

    const postConfig = {
      method: "post",
      url: config.check_order_status_endpoint,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: qs.stringify(postData),
    };

    const result = await axios(postConfig);

    let orderId = null;
    // Safely parse embed_data if it exists
    if (result.data.embed_data) {
      try {
        const embedData = JSON.parse(result.data.embed_data);
        orderId = embedData?.orderId;
      } catch (parseError) {
        console.error("Error parsing embed_data:", parseError);
      }
    }

    // If payment is successful (return_code = 1)
    if (result.data.return_code === 1) {
      if (orderId) {
        await Booking.findByIdAndUpdate(
          orderId,
          {
            paymentStatus: "paid",
            updatedAt: new Date(),
            zpTransactionId: result.data.zp_trans_id,
            amount: result.data.amount,
            discountAmount: result.data.discount_amount || 0,
          },
          { new: true, runValidators: true }
        );
      }
    }
    // If payment is still processing (return_code = 3 or is_processing = true)
    else if (result.data.return_code === 3 || result.data.is_processing) {
      if (orderId) {
        await Booking.findByIdAndUpdate(
          orderId,
          {
            paymentStatus: "processing",
            updatedAt: new Date(),
          },
          { new: true, runValidators: true }
        );
      }
    }
    // If payment failed (return_code = 2)
    else if (result.data.return_code === 2) {
      if (orderId) {
        await Booking.findByIdAndUpdate(
          orderId,
          {
            paymentStatus: "failed",
            updatedAt: new Date(),
            paymentError:
              result.data.sub_return_message || result.data.return_message,
          },
          { new: true, runValidators: true }
        );
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        return_code: result.data.return_code,
        return_message: result.data.return_message,
        sub_return_code: result.data.sub_return_code,
        sub_return_message: result.data.sub_return_message,
        is_processing: result.data.is_processing,
        amount: result.data.amount,
        discount_amount: result.data.discount_amount,
        zp_trans_id: result.data.zp_trans_id,
        orderId: orderId,
      },
    });
  } catch (error) {
    console.error("Error checking order status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check order status",
      error: error.message,
      details: error.response?.data,
    });
  }
});
export default router;
