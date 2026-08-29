app.post("/api/events", (req, res) => {
  const { visitorId, event, page } = req.body;

  saveEvent({
    visitorId,
    event,
    page
  });

  res.json({ success: true });
});