export async function logActivity(run, {actorID, action, submissionId=null, message}){

    await run(
        `INSERT INTO activity_log (actor_id, action, submission_id, message) VALUES($1, $2, $3, $4)`,
        [actorID, action, submissionId, message],
    );
}