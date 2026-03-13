export interface Comment {
	id: number;
	author: string;
	content: string;
}

export async function getComments(db: D1Database): Promise<Comment[]> {
	const { results } = await db.prepare("SELECT * FROM comments").all<Comment>();
	return results;
}

export async function getCommentById(db: D1Database, id: number): Promise<Comment | null> {
	return db.prepare("SELECT * FROM comments WHERE id = ?").bind(id).first<Comment>();
}

export async function createComment(db: D1Database, author: string, content: string): Promise<Comment | null> {
	return db
		.prepare("INSERT INTO comments (author, content) VALUES (?, ?) RETURNING *")
		.bind(author, content)
		.first<Comment>();
}

export async function deleteComment(db: D1Database, id: number): Promise<void> {
	await db.prepare("DELETE FROM comments WHERE id = ?").bind(id).run();
}
