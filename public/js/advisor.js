async function fetchAndUpdate() {
	const session = await fetch("api/session");
	// const user = JSON.parse(localStorage.getItem("user"));
	// if (!user || !user.username) {
	// 	console.error("User not logged in or missing username");
	// 	return;
	// }
	//
	// const id = Number.parseInt(user.username);
	const json = await session.json();
	const role = json.role;

	console.log("Role:", role);

	await fetch(`/api/petitions/role/${role}`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	})
		.then(async (response) => await response.json())
		.then((data) => {
			console.log("Fetched petition data:", data);

			if (Array.isArray(data.data)) {
				// Arrays to hold petitions based on status
				const approved = [];
				const inProgress = [];
				const denied = [];

				for (const petition of data.data) {
					if (
						petition[`${role}_status`] === "approved" &&
						petition[`${role}_id`]
					) {
						console.log("Processing petition:", petition); // Log each petition
						approved.push(petition);
					} else if (

						petition[`${role}_status`] === "waiting" &&
						!petition[`${role}_id`] &&
						petition.status !== "rejected"
					) {
						console.log("Processing petition:", petition); // Log each petition
						inProgress.push(petition);
					} else if (
						petition[`${role}_status`] === "rejected" &&
						petition[`${role}_id`]
					) {
						console.log("Processing petition:", petition); // Log each petition
						denied.push(petition);
					}
					// switch (petition.status) {
					// 	case "approved":
					// 		approved.push(petition);
					// 		break;
					// 	case "pending":
					// 		inProgress.push(petition);
					// 		break;
					// 	case "rejected":
					// 		denied.push(petition);
					// 		break;
					// 	default:
					// 		console.warn(`Unknown petition status: ${petition.status}`);
					// }
				}

				// Store petition status globally
				window.petitionStatus = {
					denied,
					inProgress,
					approved,
				};

				// Display all petitions by default
				updatePetitionStatus("รอดำเนินการ", inProgress);
			} else {
				console.error("No petitions found or incorrect data format");
			}
		})
		.catch((error) => console.error("Error fetching petition data:", error));
}

async function updatePetitionStatus(statusLabel, petitions) {
	const session = await fetch("api/session");
	// const user = JSON.parse(localStorage.getItem("user"));
	// if (!user || !user.username) {
	// 	console.error("User not logged in or missing username");
	// 	return;
	// }
	//
	// const id = Number.parseInt(user.username);
	const json = await session.json();
	const role = json.role;
	const container = document.querySelector(".requests-container");
	const title = document.querySelector(".requests-title");
	title.textContent = statusLabel;
	if (!container) {
		console.warn("No requests container found!");
		return;
	}
	container.innerHTML = ""; // Clear the container

	if (petitions.length > 0) {
		for (const petition of petitions) {
			const petitionCard = document.createElement("div");
			petitionCard.classList.add("request-card");

			petitionCard.innerHTML = `
            <div class="request-content">
                <p class="request-title">${petition.content.topic}</p>
                <p class="request-status">สาเหตุ: ${petition.content.reason}</p>
				<p class="request-badge">status: <span>${petition.status}</span><p>
            </div>
            <div class="request-actions">
                <button class="check-advisor-btn">เช็คคำร้อง</button>
            </div>`;
			if (petition.advisor_status !== "waiting") {
				petitionCard.querySelector(".check-advisor-btn").textContent =
					"ดูข้อมูลคำร้อง";
			}
			petitionCard
				.querySelector(".check-advisor-btn")
				.addEventListener("click", async () => {
					try {
						const response = await fetch(
							`/api/approval/${petition.petition_id}`,
							{
								method: "GET",
								headers: {
									"Content-Type": "application/json",
								},
							},
						);

						if (!response.ok) {
							throw new Error(
								`Error fetching approval: ${response.statusText}`,
							);
						}

						console.log(petition.petition_id);

						const data = await response.json();
						console.log("Approval data:", data);

						// edit
						sessionStorage.setItem("checkID", petition.petition_id);
						// console.log(petition.status);
						if (petition[`${role}_status`] !== "waiting") {
							window.location.href = "/read";
						} else {
							window.location.href = "/check";
						}


					} catch (e) {
						console.error(e);
					}
				});


			//badge color change
			const badge = petitionCard.querySelector("span");
			if (petition[`${role}_status`] === "waiting") {
				badge.style.backgroundColor = "grey";
			} else if (petition[`${role}_status`] === "approved") {
				badge.style.backgroundColor = "#9BCF53";
			} else {
				badge.style.backgroundColor = "red";
			}

			container.appendChild(petitionCard);
		}
	} else {
		container.innerHTML = "<p>ไม่มีคำร้องในสถานะนี้</p>";
	}
}

// Tab switching logic
for (const tab of document.querySelectorAll(".tab-btn")) {
	tab.addEventListener("click", () => {
		const status = tab.dataset.tab;

		// Clear active state for tabs

		for (const t of document.querySelectorAll(".tab-btn")) {
			t.classList.remove("active");
		}

		tab.classList.add("active");

		tab.setAttribute("aria-selected", "true");

		for (const t of document.querySelectorAll(
			".tab-btn:not([aria-selected='true'])",
		)) {
			t.setAttribute("aria-selected", "false");
		}

		// Update petitions based on selected tab
		const statusMap = {
			waiting: {
				label: "อยู่ระหว่างดำเนินการ",
				data: window.petitionStatus.inProgress,
			},
			rejected: { label: "ปฏิเสธคำร้อง", data: window.petitionStatus.denied },
			completed: { label: "อนุมัติแล้ว", data: window.petitionStatus.approved },
		};

		if (statusMap[status]) {
			updatePetitionStatus(statusMap[status].label, statusMap[status].data);
		} else {
			console.warn("Unknown tab selected");
		}
	});
}

// Fetch data when the page loads
document.addEventListener("DOMContentLoaded", fetchAndUpdate);
