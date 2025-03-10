import express from "express";
import { getUser } from "../server/db/user.js";

const router = express.Router();

router.post("/api/login", async (req, res) => {
	if (!process.env.TU_API_KEY) {
		console.error("Please set the TU_API_KEY environment variable");
		return res.status(500).json({ error: "Internal Server Error" });
	}

	const { username, password } = req.body;

	// Validate request body
	if (!username || !password) {
		return res
			.status(400)
			.json({ error: "Username and password are required" });
	}

	// WARNING: This is for development only. Remove this in production
	const devUser = ["advisor", "staff", "instructor", "dean", "test"];

	if (devUser.includes(username)) {
		try {
			const user = await getUser(username, password);
			req.session.user = user;
			return res.redirect("/advisor");
		} catch (error) {
			return res.status(500).json({ error: "Invalid credentials" });
		}
	}

	try {
		const response = await fetch(
			"https://restapi.tu.ac.th/api/v1/auth/Ad/verify",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Application-Key": process.env.TU_API_KEY,
				},
				body: JSON.stringify({
					UserName: username,
					PassWord: password,
				}),
			},
		);

		// Handle API response statuses
		if (!response.ok) {
			const errorText = await response.text();
			console.error(`TU API Error [${response.status}]: ${errorText}`);
			return res
				.status(response.status)
				.json({ error: "Authentication failed" });
		}

		const result = await response.json();
		const { status, message, ...filteredResult } = result;
		filteredResult.role = "student";
		req.session.user = filteredResult;


		// return res.status(200).json({ user: result, redirectTo: '/status' });
		return res.redirect("/petition");
	} catch (error) {
		console.error("Fetch error:", error);
		return res.status(500).json({ error: "Internal server error" });
	}
});

// Logout route
router.get("/api/logout", (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			console.log(err);
			return res.status(500).json({ error: "Error logging out" });
		}
		res.redirect("/");
	});
});

router.get("/api/session", (req, res) => {
	return res.json(req.session.user);
});

export default router;
