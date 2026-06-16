import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import "dotenv/config";

async function resetPasswords() {
  try {
    console.log("🔑 Starting absolute password reset process...");

    // Determine the database URIs to check
    const uris = [];
    if (process.env.MONGODB_URI) {
      uris.push(process.env.MONGODB_URI);
    }
    // Add default fallbacks
    uris.push("mongodb://127.0.0.1:27017/mlm");
    uris.push("mongodb://127.0.0.1:27017/akngroup");

    // Remove duplicates
    const uniqueUris = Array.from(new Set(uris));

    const hashedPassword = await bcrypt.hash("123456", 10);
    const adminEmail = "psikologabdulkadirkan@gmail.com";

    for (const uri of uniqueUris) {
      try {
        console.log(`\nConnecting to: ${uri}...`);
        // Disconnect first if active
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }
        await mongoose.connect(uri);
        console.log("Connected successfully!");

        // Define user schema dynamically to avoid compile/model issues
        const db = mongoose.connection.db;
        const usersCollection = db.collection("users");

        const totalUsers = await usersCollection.countDocuments({});
        console.log(`Total users in this DB: ${totalUsers}`);

        // Find all non-admin users
        const nonAdmins = await usersCollection.find({
          email: { $ne: adminEmail },
          role: { $ne: "admin" }
        }).toArray();

        console.log(`Found ${nonAdmins.length} non-admin users.`);

        if (nonAdmins.length > 0) {
          const result = await usersCollection.updateMany(
            {
              email: { $ne: adminEmail },
              role: { $ne: "admin" }
            },
            {
              $set: { password: hashedPassword }
            }
          );
          console.log(`✅ [SUCCESS] Password for ${result.modifiedCount} accounts reset to "123456" in DB.`);
          
          // Let's print sultan20 info if found
          const sultan20 = nonAdmins.find(u => u.email === "sultan20@akngroup.com" || u.email?.toLowerCase() === "sultan20@akngroup.com");
          if (sultan20) {
            console.log(`⭐ sultan20@akngroup.com was found! Object:`, {
              id: sultan20.id,
              email: sultan20.email,
              fullName: sultan20.fullName,
              isActive: sultan20.isActive,
              role: sultan20.role,
              memberId: sultan20.memberId
            });
            // Ensure isActive is true
            if (!sultan20.isActive) {
              await usersCollection.updateOne({ _id: sultan20._id }, { $set: { isActive: true } });
              console.log("⭐ Set sultan20 account to active=true.");
            }
          } else {
            console.log("⚠️ sultan20@akngroup.com was NOT found in this database.");
          }
        }
      } catch (dbErr: any) {
        console.error(`Error processing DB ${uri}:`, dbErr.message);
      }
    }

    console.log("\n👋 Process completed successfully.");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Fatal error resetting passwords:", error);
    process.exit(1);
  }
}

resetPasswords();
