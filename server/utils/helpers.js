import { randomUUID } from 'node:crypto';

export const createId = () => randomUUID();

export function asyncHandler(controller) {
    return function handledRoute(request, response, next) {
        Promise.resolve(controller(request, response, next)).catch(next);
    };
}

export function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

export function toSqlDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw httpError(422, 'Please choose a valid booking date and time.');
    }
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function normalizeTime(value) {
    return String(value || '').slice(0, 5);
}
