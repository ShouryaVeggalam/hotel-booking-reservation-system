/**
 * Room and room type services.
 *
 * Room numbers and room type names are protected by UNIQUE
 * constraints in the database. The service turns the resulting
 * duplicate-key error into a clear 409 response.
 */
import { query, queryOne, execute } from '../db/pool.js';
import ApiError from '../utils/apiError.js';
import { escapeLike } from '../utils/validators.js';

const ROOM_STATUSES = ['Available', 'Maintenance', 'Inactive'];

const ROOM_SELECT = `
  SELECT r.room_id, r.room_number, r.room_type_id, r.floor_no, r.room_status,
         rt.type_name, rt.base_price, rt.capacity,
         (SELECT COUNT(*) FROM reservation res
           WHERE res.room_id = r.room_id
             AND res.reservation_status IN ('Pending','Confirmed','Checked_In')) AS active_bookings,
         (SELECT COUNT(*) FROM reservation res WHERE res.room_id = r.room_id) AS total_bookings
  FROM room r
  JOIN room_type rt ON rt.room_type_id = r.room_type_id`;

export async function listRooms({ q = null, status = null, roomTypeId = null } = {}) {
  const where = [];
  const params = [];

  if (q) {
    where.push('(r.room_number LIKE ? OR rt.type_name LIKE ?)');
    params.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`);
  }
  if (status) {
    where.push('r.room_status = ?');
    params.push(status);
  }
  if (roomTypeId) {
    where.push('r.room_type_id = ?');
    params.push(roomTypeId);
  }

  const sql = `${ROOM_SELECT}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY r.room_number`;
  return query(sql, params);
}

export async function getRoom(roomId) {
  const room = await queryOne(`${ROOM_SELECT} WHERE r.room_id = ?`, [roomId]);
  if (!room) throw ApiError.notFound(`Room ${roomId} does not exist.`);
  return room;
}

export async function createRoom({ room_number, room_type_id, floor_no, room_status }) {
  const result = await execute(
    `INSERT INTO room (room_number, room_type_id, floor_no, room_status)
     VALUES (?, ?, ?, ?)`,
    [room_number, room_type_id, floor_no, room_status],
  );
  return getRoom(result.insertId);
}

export async function updateRoom(roomId, { room_number, room_type_id, floor_no, room_status }) {
  const existing = await getRoom(roomId);
  await execute(
    `UPDATE room
        SET room_number = ?, room_type_id = ?, floor_no = ?, room_status = ?
      WHERE room_id = ?`,
    [
      room_number ?? existing.room_number,
      room_type_id ?? existing.room_type_id,
      floor_no ?? existing.floor_no,
      room_status ?? existing.room_status,
      roomId,
    ],
  );
  return getRoom(roomId);
}

export async function updateRoomStatus(roomId, room_status) {
  const room = await getRoom(roomId);
  if (room.active_bookings > 0 && room_status !== 'Available') {
    throw ApiError.conflict(
      `Room ${room.room_number} still has ${room.active_bookings} active reservation(s) and cannot be taken out of service.`,
    );
  }
  await execute('UPDATE room SET room_status = ? WHERE room_id = ?', [room_status, roomId]);
  return getRoom(roomId);
}

export async function deleteRoom(roomId) {
  const room = await getRoom(roomId);
  if (room.total_bookings > 0) {
    throw ApiError.conflict(
      `Room ${room.room_number} has ${room.total_bookings} reservation(s) in its history and cannot be deleted. Set it to Inactive instead.`,
    );
  }
  await execute('DELETE FROM room WHERE room_id = ?', [roomId]);
  return { deleted: true, room_id: roomId };
}

/* ------------------------------------------------------------------ */
/* Room types                                                          */
/* ------------------------------------------------------------------ */

export async function listRoomTypes() {
  return query(
    `SELECT rt.room_type_id, rt.type_name, rt.base_price, rt.capacity, rt.description,
            COUNT(r.room_id) AS room_count
     FROM room_type rt
     LEFT JOIN room r ON r.room_type_id = rt.room_type_id
     GROUP BY rt.room_type_id, rt.type_name, rt.base_price, rt.capacity, rt.description
     ORDER BY rt.base_price`,
  );
}

export async function getRoomType(roomTypeId) {
  const type = await queryOne(
    `SELECT rt.room_type_id, rt.type_name, rt.base_price, rt.capacity, rt.description,
            COUNT(r.room_id) AS room_count
     FROM room_type rt
     LEFT JOIN room r ON r.room_type_id = rt.room_type_id
     WHERE rt.room_type_id = ?
     GROUP BY rt.room_type_id, rt.type_name, rt.base_price, rt.capacity, rt.description`,
    [roomTypeId],
  );
  if (!type) throw ApiError.notFound(`Room type ${roomTypeId} does not exist.`);
  return type;
}

export async function createRoomType({ type_name, base_price, capacity, description }) {
  const result = await execute(
    `INSERT INTO room_type (type_name, base_price, capacity, description)
     VALUES (?, ?, ?, ?)`,
    [type_name, base_price, capacity, description ?? null],
  );
  return getRoomType(result.insertId);
}

export async function updateRoomType(roomTypeId, { type_name, base_price, capacity, description }) {
  const existing = await getRoomType(roomTypeId);
  await execute(
    `UPDATE room_type
        SET type_name = ?, base_price = ?, capacity = ?, description = ?
      WHERE room_type_id = ?`,
    [
      type_name ?? existing.type_name,
      base_price ?? existing.base_price,
      capacity ?? existing.capacity,
      description === undefined ? existing.description : description,
      roomTypeId,
    ],
  );
  return getRoomType(roomTypeId);
}

export async function deleteRoomType(roomTypeId) {
  const type = await getRoomType(roomTypeId);
  if (type.room_count > 0) {
    throw ApiError.conflict(
      `Room type "${type.type_name}" is used by ${type.room_count} room(s) and cannot be deleted.`,
    );
  }
  await execute('DELETE FROM room_type WHERE room_type_id = ?', [roomTypeId]);
  return { deleted: true, room_type_id: roomTypeId };
}

export { ROOM_STATUSES };
export default {
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
  listRoomTypes,
  getRoomType,
  createRoomType,
  updateRoomType,
  deleteRoomType,
};
