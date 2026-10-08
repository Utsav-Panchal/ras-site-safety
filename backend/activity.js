/** Writes one line to the activity log. `run` is query() or the transaction's run(). */
export async function logActivity(run, { actorId, action, submissionId = null, message }) {
    await run(
        `INSERT INTO activity_log (actor_id, action, submission_id, message) VALUES ($1, $2, $3, $4)`,
        [actorId, action, submissionId, message],
    );
}