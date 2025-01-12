  import { useState, useEffect } from "react";
  import { Client, Account, Databases, Storage } from "appwrite";
  import { motion, AnimatePresence } from "framer-motion";
  import QRCode from "qrcode";
  import { Switch } from "@headlessui/react";

  const client = new Client();
  client
    .setEndpoint("https://cloud.appwrite.io/v1") // Replace with your Appwrite endpoint
    .setProject("6763fe500006de594234"); // Replace with your Project ID

  const account = new Account(client);
  const databases = new Databases(client);
  const storage = new Storage(client);

  function App() {
    const [user, setUser] = useState(null);
    const [formData, setFormData] = useState({
      name: "",
      description: "",
      price: 0,
      category: "",
    });
    const [authData, setAuthData] = useState({
      email: "",
      password: "",
      name: "",
    });
    const [qrCodeUrl, setQrCodeUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    // Check for active session on component mount
    useEffect(() => {
      const checkSession = async () => {
        try {
          const session = await account.getSession("current");
          if (session) {
            const userData = await account.get(session.userId);  // Fetch user details
            setUser(userData);
          }
        } catch (error) {
          console.log("No active session found.");
        }
      };
      checkSession();
    }, []);

    // Handle input changes for authentication and product creation forms
    const handleInputChange = (e, isAuth = false) => {
      const { name, value } = e.target;
      if (isAuth) {
        setAuthData((prevData) => ({ ...prevData, [name]: value }));
      } else {
        setFormData((prevData) => ({ ...prevData, [name]: value }));
      }
    };

    // Handle user registration
    const handleRegister = async () => {
      try {
        const newUser = await account.create(
          "unique()", // Generate a unique ID for the user
          authData.email,
          authData.password,
          authData.name
        );
        console.log("User registered:", newUser);
        alert("Registration successful! You can now log in.");
        setIsRegistering(false);
      } catch (error) {
        console.error("Registration failed:", error.message);
      }
    };

    const handleLogin = async () => {
  if (user) {
    console.log("User already logged in:", user);
    return;
  }

  try {
    // Create a session using email and password
    const userSession = await account.createEmailPasswordSession(authData.email, authData.password);
    console.log("Session created:", userSession);

    // Fetch user data after login
    const userData = await account.get();

    // Check if the user has the 'admin' label
    if (!userData.labels.includes("admin")) {
      console.warn("Access denied: Only admins can log in.");
      alert("Access denied. You must be an admin to access this platform.");

      // Log the user out if they don't have the 'admin' label
      if (userSession.$id) {
        await account.deleteSession(userSession.$id);
      }
      return;
    }

    // Set the user in state
    setUser(userData);
    console.log("Logged in as admin:", userData);
  } catch (error) {
    console.error("Login failed:", error.message);

    // Handle specific errors
    if (error.code === 401) {
      alert("Unauthorized: Please check your credentials.");
    } else if (error.code === 403) {
      alert("Access forbidden: You do not have permission.");
    } else {
      alert("An error occurred. Please try again later.");
    }
  }
};



    // Handle user logout
    const handleLogout = async () => {
      try {
        await account.deleteSession("current");
        setUser(null);
        console.log("Logged out successfully.");
      } catch (error) {
        console.error("Logout failed:", error.message);
      }
    };

  const handleCreateProduct = async () => {
    if (!user || !user.labels.includes("admin")) {
      alert("Only admins can create products.");
      return;
    }
    setLoading(true);
    try {
      const productId = new Date().getTime().toString();
      const productUrl = `https://ar-qr-admin.netlify.app//product/${productId}`;

      // Ensure price is an integer
      const price = parseInt(formData.price, 10);
      if (isNaN(price)) {
        alert("Please enter a valid number for the price.");
        setLoading(false);
        return;
      }

      // Generate QR Code as PNG
      const qrCodeDataUrl = await QRCode.toDataURL(productId); // Generates a PNG base64 data URL

      // Convert the base64 data URL to a Blob
      const response = await fetch(qrCodeDataUrl);
      const blob = await response.blob();

      // Create a File object to upload to Appwrite (or any other storage backend)
      const qrCodeImage = new File([blob], `${productId}.png`, { type: "image/png" });

      // Upload the QR code image to Appwrite
      const file = await storage.createFile(
        "676400af001599994721", // Replace with your Appwrite bucket ID
        productId, // Use productId as file ID
        qrCodeImage // The File object
      );

      const qrCodeFileUrl = storage.getFileView("676400af001599994721", file.$id); // Get file URL

      // Save product details in the database
      const newProduct = await databases.createDocument(
        "676400030013c65fde49", // Replace with your database ID
        "676400490003acf4906a", // Replace with your collection ID
        "unique()", // Auto-generate a unique ID
        {
          ...formData,
          price, // Use the parsed integer price
          productId: productId,
          qrCodeUrl: qrCodeFileUrl,
          productUrl: productUrl,
          createdBy: user.$id, // Use `$id` instead of `id`
        }
      );

      setQrCodeUrl(qrCodeFileUrl); // Set the QR Code URL to state
      console.log("Product created:", newProduct);
      alert("Product created successfully!");
      setFormData({
      name: "",
      description: "",
      price: 0,
      category: "",
    });
    } catch (error) {
      console.error("Error creating product:", error.message);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };


    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex items-center justify-center min-h-screen bg-gradient-to-r from-purple-400 via-pink-500 to-red-500"
      >
        <motion.div
          initial={{ scale: 0.9, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-lg"
        >
          <motion.h1
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="text-4xl font-bold text-center text-gray-800 mb-8"
          >
            {user ? `Welcome, ${user.name}` : "Welcome, Admin!"}
          </motion.h1>

          <AnimatePresence mode="wait">
            {!user ? (
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-4 w-full"
              >
                <h2 className="text-2xl font-semibold text-gray-800 text-center mb-6">
                  {isRegistering ? "Register" : "Login"}
                </h2>
                <AnimatePresence>
                  {isRegistering && (
                    <motion.input
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      autoComplete="off"
                      type="text"
                      name="name"
                      placeholder="Name"
                      value={authData.name}
                      onChange={(e) => handleInputChange(e, true)}
                      className="border-2 border-gray-300 p-3 rounded-md mb-4 w-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  )}
                </AnimatePresence>
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  autoComplete="off"
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={authData.email}
                  onChange={(e) => handleInputChange(e, true)}
                  className="border-2 border-gray-300 p-3 rounded-md mb-4 w-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  autoComplete="off"
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={authData.password}
                  onChange={(e) => handleInputChange(e, true)}
                  className="border-2 border-gray-300 p-3 rounded-md mb-4 w-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={isRegistering ? handleRegister : handleLogin}
                  className="bg-purple-600 text-white px-6 py-3 rounded-md mt-4 w-full font-semibold shadow-md hover:bg-purple-700 transition duration-300"
                >
                  {isRegistering ? "Register" : "Login"}
                </motion.button>
                <Switch
                  checked={isRegistering}
                  onChange={setIsRegistering}
                  className="flex items-center justify-center mt-4"
                >
                  <span className="mr-3 text-sm text-gray-600">
                    {isRegistering ? "Already have an account?" : "Need to register?"}
                  </span>
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={`${
                      isRegistering ? "bg-purple-600" : "bg-gray-300"
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300`}
                  >
                    <span
                      className={`${
                        isRegistering ? "translate-x-6" : "translate-x-1"
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300`}
                    />
                  </motion.div>
                </Switch>
              </motion.div>
            ) : (
              <motion.div
                key="product"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className="bg-red-500 text-white px-6 py-3 rounded-md mb-8 w-full font-semibold shadow-md hover:bg-red-600 transition duration-300"
                >
                  Logout
                </motion.button>
                <h2 className="text-2xl font-semibold text-gray-800 mb-6">Create a Product</h2>
                <motion.div className="flex flex-col gap-4">
                  {["name", "description", "price", "category"].map((field) => (
                    <motion.input
                      key={field}
                      whileFocus={{ scale: 1.02 }}
                      type={field === "price" ? "number" : "text"}
                      name={field}
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      value={formData[field]}
                      onChange={handleInputChange}
                      className="border-2 border-gray-300 p-3 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  ))}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCreateProduct}
                    disabled={loading}
                    className="bg-green-500 text-white px-6 py-3 rounded-md mt-4 w-full font-semibold shadow-md hover:bg-green-600 transition duration-300"
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-6 h-6 border-t-2 border-white rounded-full mx-auto"
                      />
                    ) : (
                      "Create Product"
                    )}
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    );
  }

  export default App;
