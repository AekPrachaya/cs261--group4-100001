import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import { addDocument, deleteDocument } from "../server/db/document.js";

/* upload document
 * @param {Multer.File} file
 * @param {string} petitionID
 * @returns {string} public_id
 */
export const uploadDocument = async (file, filename, petitionID) => {
    const mimetype = file.mimetype;
    let resourceType = "raw";
    if (mimetype.includes("image")) {
        resourceType = "image";
    } else if (mimetype.includes("pdf")) {
        resourceType = "raw";
    }
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                filename_override: filename,
                folder: `${petitionID}`,
                use_filename: true,
                resource_type: resourceType,
            },
            (error, result) => {
                if (error) {
                    reject(error); // Reject if there's an error
                } else {
                    resolve(result.public_id); // Resolve with the public_id
                }
            },
        );

        // Convert file buffer to a stream and pipe it to Cloudinary
        streamifier.createReadStream(file.buffer).pipe(stream);
    });
};
/* upload documents
 * @param {Array<Multer.File>} files
 * @param {string} petitionID
 * @returns {Array<string>} public_ids
 * */
// WARNING file name is not array it may break if u want to fix naja
export const uploadDocuments = async (fileBuffers, filename, petitionID) => {
    if (!fileBuffers || fileBuffers.length === 0) {
        return [];
    }
    try {
        // Upload to Cloudinary
        const promises = fileBuffers.map((file) =>
            uploadDocument(file, filename, petitionID),
        );

        const public_ids = await Promise.all(promises);

        // Insert to DB
        const insertPromises = public_ids.map((public_id) =>
            addDocument(petitionID, public_id),
        );
        await Promise.all(insertPromises);

        return public_ids;
    } catch (error) {
        console.error("error", error);
    }
    return [];
};

/* get documents by petition id
 * @param {string} petitionID
 * @returns {Array<Object>} files
 * */
export const getDocumentsByPetitionID = async (petitionID) => {
    try {
        // Fetch raw (PDF) resources
        const rawResult = await cloudinary.api.resources({
            type: "upload",
            prefix: petitionID,
            resource_type: "raw",
        });

        // Fetch image resources
        const imageResult = await cloudinary.api.resources({
            type: "upload",
            prefix: petitionID,
            resource_type: "image",
        });

        console.log(imageResult);

        // Combine raw and image resources
        const combinedResources = [
            ...rawResult.resources,
            ...imageResult.resources,
        ];

        // Filter and map the relevant details
        const filteredResources = combinedResources.map((resource) => ({
            public_id: resource.public_id,
            created_at: resource.created_at,
            display_name: resource.display_name,
            bytes: resource.bytes,
            format: resource.format, // Useful for distinguishing types (e.g., jpg, pdf)
            url: resource.secure_url, // Use secure URL for HTTPS
        }));

        return filteredResources; // Return the combined array
    } catch (error) {
        console.error("Error fetching documents from Cloudinary:", error);
        return []; // Return an empty array on error
    }
};

/* @deprecated unused
 * delete document by public_id
 * @param {string} public_id
 * @returns {string} file
 * */
const deleteDocumentByPublicID = async (public_id) => {
    try {
        const result = await cloudinary.api.delete_resources(public_id);

        return { public_id, ...result };
    } catch (error) {
        console.error(error);
    }
};

/* delete documents by public_ids
 * @param {Array<string>} public_ids
 * @return {Promise<Array<string>>} public_ids
 */
// FIX validate public_ids and making sure delete is successful
export const deleteDocumentsByPublicIDs = async (public_ids) => {
    try {
        if (!public_ids || !Array.isArray(public_ids) || public_ids.length === 0) {
            console.error("No valid public IDs provided.");
            return [];
        }
        // Delete files and folder on Cloudinary
        const successDeletePublicIds = [];
        await cloudinary.api
            .delete_resources(public_ids, { type: "upload", resource_type: "raw" })
            .then(async (result) => {
                const key = Object.keys(result.deleted)[0];
                const deleteFolderResult = await deleteFolderByPublicID(key);
                if (deleteFolderResult) {
                    successDeletePublicIds.push(key);
                }
            });

        return successDeletePublicIds;
    } catch (error) {
        console.error(error);
        return [];
    }
};

export const deleteFolderByPublicID = async (public_id) => {
    try {
        const folderId = `/${public_id.split("/")[0]}`;

        const result = await cloudinary.api.delete_folder(folderId);
        return result;
    } catch (error) {
        console.error("folder delete", error);
    }
};

export const deleteDocumentsInDatabaseByPublicIDs = async (public_ids) => {
    // Delete document on DB
    const deleteDocumentPromises = public_ids.map((public_id) =>
        deleteDocument(public_id),
    );
    const deletedResult = await Promise.all(deleteDocumentPromises);
    const deletedFiles = deletedResult
        .filter((item) => item !== undefined)
        .map((result) => result);
    return deletedFiles;
};
