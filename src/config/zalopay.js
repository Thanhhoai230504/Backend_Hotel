import dotenv from 'dotenv';

dotenv.config();

export const config = {
  app_id: process.env.ZALOPAY_APP_ID,
  key1: Buffer.from(process.env.ZALOPAY_KEY1 || '', 'utf-8'),
  key2: Buffer.from(process.env.ZALOPAY_KEY2 || '', 'utf-8'),
  endpoint: "https://sb-openapi.zalopay.vn/v2/create",
  check_order_status_endpoint: "https://sb-openapi.zalopay.vn/v2/query"

};