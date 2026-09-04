export function notFound(request, response) {
    response.status(404).json({ message: `Route ${request.method} ${request.path} was not found.` });
}

export function errorHandler(error, _request, response, _next) {
    if (error.code === 'LIMIT_FILE_SIZE') {
        return response.status(413).json({ message: 'Verification documents must be under 5 MB.' });
    }
    if (error.code === 'ER_DUP_ENTRY') {
        return response.status(409).json({ message: 'That record already exists.' });
    }

    const status = error.status || 500;
    if (status >= 500) {
        console.error(error);
    }
    return response.status(status).json({
        message: status >= 500 ? 'Something went wrong. Please try again.' : error.message
    });
}
