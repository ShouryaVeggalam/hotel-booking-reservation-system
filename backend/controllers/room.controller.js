/**
 * Room and room type controller.
 */
import roomService from '../services/room.service.js';
import {
  requireString,
  optionalString,
  requireInt,
  requirePositiveInt,
  requireAmount,
  requireOneOf,
  optionalOneOf,
  optionalSearch,
} from '../utils/validators.js';

const STATUSES = ['Available', 'Maintenance', 'Inactive'];

export async function listRooms(req, res) {
  const rooms = await roomService.listRooms({
    q: optionalSearch(req.query.q),
    status: optionalOneOf(req.query.status, STATUSES, 'status'),
    roomTypeId: req.query.room_type_id ? requireInt(req.query.room_type_id, 'room_type_id', { min: 1 }) : null,
  });
  res.json({ success: true, data: rooms });
}

export async function getRoom(req, res) {
  const room = await roomService.getRoom(requirePositiveInt(req.params.id, 'id'));
  res.json({ success: true, data: room });
}

export async function createRoom(req, res) {
  const room = await roomService.createRoom({
    room_number: requireString(req.body.room_number, 'room_number', { maxLength: 20 }),
    room_type_id: requirePositiveInt(req.body.room_type_id, 'room_type_id'),
    floor_no: requirePositiveInt(req.body.floor_no, 'floor_no', { max: 200 }),
    room_status: optionalOneOf(req.body.room_status, STATUSES, 'room_status', 'Available'),
  });
  res.status(201).json({ success: true, data: room });
}

export async function updateRoom(req, res) {
  const room = await roomService.updateRoom(requirePositiveInt(req.params.id, 'id'), {
    room_number: req.body.room_number === undefined
      ? undefined
      : requireString(req.body.room_number, 'room_number', { maxLength: 20 }),
    room_type_id: req.body.room_type_id === undefined
      ? undefined
      : requirePositiveInt(req.body.room_type_id, 'room_type_id'),
    floor_no: req.body.floor_no === undefined
      ? undefined
      : requirePositiveInt(req.body.floor_no, 'floor_no', { max: 200 }),
    room_status: optionalOneOf(req.body.room_status, STATUSES, 'room_status', undefined),
  });
  res.json({ success: true, data: room });
}

export async function updateRoomStatus(req, res) {
  const room = await roomService.updateRoomStatus(
    requirePositiveInt(req.params.id, 'id'),
    requireOneOf(req.body.room_status, STATUSES, 'room_status'),
  );
  res.json({ success: true, data: room });
}

export async function deleteRoom(req, res) {
  const result = await roomService.deleteRoom(requirePositiveInt(req.params.id, 'id'));
  res.json({ success: true, data: result });
}

/* ------------------------------------------------------------------ */

export async function listRoomTypes(req, res) {
  const types = await roomService.listRoomTypes();
  res.json({ success: true, data: types });
}

export async function getRoomType(req, res) {
  const type = await roomService.getRoomType(requirePositiveInt(req.params.id, 'id'));
  res.json({ success: true, data: type });
}

export async function createRoomType(req, res) {
  const type = await roomService.createRoomType({
    type_name: requireString(req.body.type_name, 'type_name', { maxLength: 50 }),
    base_price: requireAmount(req.body.base_price, 'base_price'),
    capacity: requirePositiveInt(req.body.capacity, 'capacity', { max: 50 }),
    description: optionalString(req.body.description, 'description', { maxLength: 255 }),
  });
  res.status(201).json({ success: true, data: type });
}

export async function updateRoomType(req, res) {
  const type = await roomService.updateRoomType(requirePositiveInt(req.params.id, 'id'), {
    type_name: req.body.type_name === undefined
      ? undefined
      : requireString(req.body.type_name, 'type_name', { maxLength: 50 }),
    base_price: req.body.base_price === undefined ? undefined : requireAmount(req.body.base_price, 'base_price'),
    capacity: req.body.capacity === undefined ? undefined : requirePositiveInt(req.body.capacity, 'capacity', { max: 50 }),
    description: req.body.description === undefined
      ? undefined
      : optionalString(req.body.description, 'description', { maxLength: 255 }),
  });
  res.json({ success: true, data: type });
}

export async function deleteRoomType(req, res) {
  const result = await roomService.deleteRoomType(requirePositiveInt(req.params.id, 'id'));
  res.json({ success: true, data: result });
}

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
