let applicationPromise;

function loadApplication() {
  applicationPromise ||= import('../app.js').then(({ default: app }) => app);
  return applicationPromise;
}

function safeErrorMessage(error) {
  return String(error?.message || 'Unknown startup error')
    .replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi, 'mongodb://***@');
}

export default async function handler(req, res) {
  try {
    const app = await loadApplication();
    return app(req, res);
  } catch (error) {
    applicationPromise = undefined;
    console.error('FoundBack API failed to initialize:', error);
    return res.status(500).json({
      success: false,
      message: 'FoundBack API failed to initialize',
      error: safeErrorMessage(error),
      code: error?.code || 'STARTUP_ERROR',
    });
  }
}
