import { supplierSyncQueue } from '../config/queue';
import MarketOrder from '../models/MarketOrder';
import * as supplierApi from '../services/supplierApi.service';
import logger from '../utils/logger';

/**
 * Supplier Sync Worker
 * Syncs market orders to Supplier API
 */

supplierSyncQueue.process(async (job) => {
  const { orderId, orderData } = job.data;

  logger.info('🔄 Processing supplier sync job', {
    jobId: job.id,
    orderId,
  });

  try {
    // Get order from database
    const order = await MarketOrder.findById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Create order in Supplier system
    const supplierOrder = await supplierApi.createSupplierOrder({
      consumerUserId: orderData.consumerUserId,
      consumerOrderId: order._id.toString(),
      supplierId: orderData.supplierId,
      priceType: orderData.priceType,
      items: orderData.items.map((item: any) => ({
        productId: item.productId,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      deliveryAddress: orderData.deliveryAddress,
      deliveryMethod: orderData.deliveryMethod,
      deliveryDate: orderData.deliveryDate,
      paymentMethod: orderData.paymentMethod,
      notes: orderData.notes,
    });

    // Update order with supplier info
    order.supplierOrderId = supplierOrder.supplierOrderId;
    order.supplierSyncStatus = 'synced';
    order.supplierSyncedAt = new Date();
    await order.save();

    logger.info('✅ Order synced to supplier successfully', {
      jobId: job.id,
      orderId,
      supplierOrderId: supplierOrder.supplierOrderId,
    });

    return {
      orderId,
      supplierOrderId: supplierOrder.supplierOrderId,
      status: 'synced',
    };
  } catch (error: any) {
    logger.error('❌ Failed to sync order to supplier', {
      jobId: job.id,
      orderId,
      error: error.message,
      stack: error.stack,
    });

    // Update order sync status
    try {
      const order = await MarketOrder.findById(orderId);
      if (order) {
        order.supplierSyncStatus = 'failed';
        order.supplierSyncError = error.message;
        await order.save();
      }
    } catch (updateError) {
      logger.error('Failed to update order sync status', { orderId, updateError });
    }

    // Throw error to trigger retry
    throw error;
  }
});

logger.info('📦 Supplier sync worker initialized');

export default supplierSyncQueue;


