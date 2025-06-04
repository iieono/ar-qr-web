"use client";

import { useState, useEffect } from "react";
import { Client, Account, Databases, Storage } from "appwrite";
import QRCode from "qrcode";

const client = new Client();
client
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("6763fe500006de594234");

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);

function App() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentView, setCurrentView] = useState("login");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    category: "",
    expirationDate: "",
    isHalal: false,
    productImage: null,
    certificateFile: null,
  });
  const [authData, setAuthData] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [previewUrls, setPreviewUrls] = useState({
    productImage: null,
    certificateFile: null,
  });

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (user && currentView === "dashboard") {
      fetchProducts();
    }
  }, [user, currentView]);

  // Clean up preview URLs when component unmounts or form resets
  useEffect(() => {
    return () => {
      if (previewUrls.productImage) {
        URL.revokeObjectURL(previewUrls.productImage);
      }
      if (previewUrls.certificateFile) {
        URL.revokeObjectURL(previewUrls.certificateFile);
      }
    };
  }, [previewUrls]);

  const checkSession = async () => {
    try {
      const userData = await account.get();
      if (!userData.labels.includes("admin")) {
        await account.deleteSession("current");
        return;
      }
      setUser(userData);
      setCurrentView("dashboard");
    } catch (error) {
      console.log("No active session found.");
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await databases.listDocuments(
        "676400030013c65fde49",
        "676400490003acf4906a"
      );
      setProducts(response.documents);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (user) return;

    try {
      const userSession = await account.createEmailPasswordSession(
        authData.email,
        authData.password
      );
      const userData = await account.get();

      if (!userData.labels.includes("admin")) {
        alert("Access denied. You must be an admin to access this platform.");
        if (userSession.$id) {
          await account.deleteSession(userSession.$id);
        }
        return;
      }

      setUser(userData);
      setCurrentView("dashboard");
    } catch (error) {
      console.error("Login failed:", error.message);
      alert("Login failed. Please check your credentials.");
    }
  };

  const handleRegister = async () => {
    try {
      await account.create(
        "unique()",
        authData.email,
        authData.password,
        authData.name
      );
      alert("Registration successful! You can now log in.");
      setIsRegistering(false);
    } catch (error) {
      console.error("Registration failed:", error.message);
      alert("Registration failed: " + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await account.deleteSession("current");
      setUser(null);
      setCurrentView("login");
    } catch (error) {
      console.error("Logout failed:", error.message);
    }
  };

  const calculateDaysLeft = (expirationDate) => {
    const today = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleFileUpload = async (file, fileName) => {
    try {
      const uploadedFile = await storage.createFile(
        "676400af001599994721",
        fileName,
        file
      );
      return storage.getFileView("676400af001599994721", uploadedFile.$id);
    } catch (error) {
      console.error("File upload failed:", error);
      throw error;
    }
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      // Clean up previous preview URL
      if (previewUrls[fieldName]) {
        URL.revokeObjectURL(previewUrls[fieldName]);
      }

      // Create new preview URL
      const previewUrl = URL.createObjectURL(file);
      setPreviewUrls((prev) => ({
        ...prev,
        [fieldName]: previewUrl,
      }));

      setFormData((prev) => ({
        ...prev,
        [fieldName]: file,
      }));
    }
  };

  const handleCreateProduct = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const productId = new Date().getTime().toString();
      const createdDate = new Date().toISOString();

      // Convert date input to ISO format for storage
      const expirationDateISO = formData.expirationDate
        ? new Date(formData.expirationDate + "T00:00:00.000Z").toISOString()
        : new Date().toISOString();

      let productImageUrl = "";
      if (formData.productImage) {
        productImageUrl = await handleFileUpload(
          formData.productImage,
          `product_${productId}`
        );
      }

      let certificateFileUrl = "";
      if (formData.certificateFile) {
        certificateFileUrl = await handleFileUpload(
          formData.certificateFile,
          `cert_${productId}`
        );
      }

      const qrCodeDataUrl = await QRCode.toDataURL(productId);
      const response = await fetch(qrCodeDataUrl);
      const blob = await response.blob();
      const qrCodeImage = new File([blob], `${productId}.png`, {
        type: "image/png",
      });

      const qrCodeFile = await storage.createFile(
        "676400af001599994721",
        `qr_${productId}`,
        qrCodeImage
      );
      const qrCodeFileUrl = storage.getFileView(
        "676400af001599994721",
        qrCodeFile.$id
      );

      const newProduct = await databases.createDocument(
        "676400030013c65fde49",
        "676400490003acf4906a",
        "unique()",
        {
          name: formData.name,
          description: formData.description,
          price: Number.parseInt(formData.price, 10),
          category: formData.category,
          productId: productId,
          qrCodeUrl: qrCodeFileUrl,
          productUrl: `https://ar-qr-admin.netlify.app/product/${productId}`,
          productImage: productImageUrl,
          certificateFile: certificateFileUrl,
          createdDate: createdDate,
          expirationDate: expirationDateISO,
          isHalal: formData.isHalal,
          createdBy: user.$id,
        }
      );

      setProducts([...products, newProduct]);
      setCurrentView("dashboard");
      resetForm();
      alert("Product created successfully!");
    } catch (error) {
      console.error("Error creating product:", error);
      alert("Error creating product");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!selectedProduct) return;

    setLoading(true);
    try {
      let productImageUrl = selectedProduct.productImage;
      let certificateFileUrl = selectedProduct.certificateFile;

      // Convert date input to ISO format for storage
      const expirationDateISO = formData.expirationDate
        ? new Date(formData.expirationDate + "T00:00:00.000Z").toISOString()
        : selectedProduct.expirationDate;

      if (formData.productImage) {
        productImageUrl = await handleFileUpload(
          formData.productImage,
          `product_${selectedProduct.productId}_updated`
        );
      }

      if (formData.certificateFile) {
        certificateFileUrl = await handleFileUpload(
          formData.certificateFile,
          `cert_${selectedProduct.productId}_updated`
        );
      }

      const updatedProduct = await databases.updateDocument(
        "676400030013c65fde49",
        "676400490003acf4906a",
        selectedProduct.$id,
        {
          name: formData.name,
          description: formData.description,
          price: Number.parseInt(formData.price, 10),
          category: formData.category,
          expirationDate: expirationDateISO,
          isHalal: formData.isHalal,
          productImage: productImageUrl,
          certificateFile: certificateFileUrl,
        }
      );

      setProducts(
        products.map((p) =>
          p.$id === selectedProduct.$id ? updatedProduct : p
        )
      );
      setCurrentView("dashboard");
      resetForm();
      alert("Product updated successfully!");
    } catch (error) {
      console.error("Error updating product:", error);
      alert("Error updating product");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      await databases.deleteDocument(
        "676400030013c65fde49",
        "676400490003acf4906a",
        productId
      );
      setProducts(products.filter((p) => p.$id !== productId));
      alert("Product deleted successfully!");
    } catch (error) {
      console.error("Error deleting product:", error);
      alert("Error deleting product");
    }
  };

  const resetForm = () => {
    // Clean up preview URLs
    if (previewUrls.productImage) {
      URL.revokeObjectURL(previewUrls.productImage);
    }
    if (previewUrls.certificateFile) {
      URL.revokeObjectURL(previewUrls.certificateFile);
    }

    setFormData({
      name: "",
      description: "",
      price: 0,
      category: "",
      expirationDate: "",
      isHalal: false,
      productImage: null,
      certificateFile: null,
    });
    setPreviewUrls({
      productImage: null,
      certificateFile: null,
    });
    setSelectedProduct(null);
  };

  const openCreateModal = () => {
    resetForm(); // Clear all fields when opening create modal
    setCurrentView("create");
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);

    // Convert ISO date to YYYY-MM-DD format for date input
    const formatDateForInput = (isoDate) => {
      if (!isoDate) return "";
      try {
        // Handle both ISO string and date object formats
        const date = new Date(isoDate);
        if (isNaN(date.getTime())) return "";

        // Get local date in YYYY-MM-DD format
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
      } catch (error) {
        console.error("Date formatting error:", error);
        return "";
      }
    };

    // Clean up any existing preview URLs
    if (previewUrls.productImage) {
      URL.revokeObjectURL(previewUrls.productImage);
    }
    if (previewUrls.certificateFile) {
      URL.revokeObjectURL(previewUrls.certificateFile);
    }

    setFormData({
      name: product.name || "",
      description: product.description || "",
      price: product.price || 0,
      category: product.category || "",
      expirationDate: formatDateForInput(product.expirationDate),
      isHalal: product.isHalal || false,
      productImage: null,
      certificateFile: null,
    });

    // Set preview URLs to existing files
    setPreviewUrls({
      productImage: product.productImage || null,
      certificateFile: product.certificateFile || null,
    });

    setCurrentView("edit");
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(products.map((p) => p.category))];

  // Calculate stats
  const totalProducts = products.length;
  const expiredProducts = products.filter(
    (p) => calculateDaysLeft(p.expirationDate) < 0
  ).length;
  const expiringSoon = products.filter((p) => {
    const days = calculateDaysLeft(p.expirationDate);
    return days >= 0 && days <= 30;
  }).length;
  const validProducts = totalProducts - expiredProducts - expiringSoon;
  const halalProducts = products.filter((p) => p.isHalal).length;

  // Login View
  if (currentView === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <div className="relative z-10 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 w-full max-w-md shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 11-18 0 4 4 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {isRegistering ? "Create Account" : "Welcome Back"}
            </h1>
            <p className="text-white/70">
              {isRegistering
                ? "Join our admin platform"
                : "Sign in to your admin account"}
            </p>
          </div>

          <div className="space-y-4">
            {isRegistering && (
              <div>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={authData.name}
                  onChange={(e) =>
                    setAuthData({ ...authData, name: e.target.value })
                  }
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
            <div>
              <input
                type="email"
                placeholder="Email Address"
                value={authData.email}
                onChange={(e) =>
                  setAuthData({ ...authData, email: e.target.value })
                }
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                value={authData.password}
                onChange={(e) =>
                  setAuthData({ ...authData, password: e.target.value })
                }
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={isRegistering ? handleRegister : handleLogin}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition duration-200 shadow-lg"
            >
              {isRegistering ? "Create Account" : "Sign In"}
            </button>
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="w-full text-white/70 hover:text-white transition duration-200"
            >
              {isRegistering
                ? "Already have an account? Sign in"
                : "Need an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Layout
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-16"
        } bg-white shadow-lg transition-all duration-300 flex flex-col`}
      >
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <span className="font-bold text-gray-800">ProductHub</span>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-2">
            <button
              onClick={() => setCurrentView("dashboard")}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                currentView === "dashboard"
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
                />
              </svg>
              {sidebarOpen && <span>Dashboard</span>}
            </button>
            <button
              onClick={openCreateModal}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                currentView === "create"
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              {sidebarOpen && <span>Add Product</span>}
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div
            className={`flex items-center ${
              sidebarOpen ? "space-x-3" : "justify-center"
            }`}
          >
            <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {user?.name?.charAt(0)}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-500">Admin</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={handleLogout}
              className="w-full mt-3 flex items-center justify-center space-x-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {currentView === "dashboard" && "Dashboard"}
                {currentView === "create" && "Add New Product"}
                {currentView === "edit" && "Edit Product"}
                {currentView === "view" && "Product Details"}
              </h1>
              <p className="text-gray-600">
                {currentView === "dashboard" &&
                  `Manage your ${totalProducts} products`}
                {currentView === "create" &&
                  "Create a new product with QR code"}
                {currentView === "edit" && "Update product information"}
                {currentView === "view" && "View detailed product information"}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Welcome back,</p>
                <p className="font-semibold text-gray-900">{user?.name}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        {currentView === "dashboard" && (
          <main className="flex-1 overflow-y-auto p-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total Products
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      {totalProducts}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Valid Products
                    </p>
                    <p className="text-3xl font-bold text-green-600">
                      {validProducts}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Expiring Soon
                    </p>
                    <p className="text-3xl font-bold text-yellow-600">
                      {expiringSoon}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-yellow-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Expired</p>
                    <p className="text-3xl font-bold text-red-600">
                      {expiredProducts}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 14l2-2m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Halal Products
                    </p>
                    <p className="text-3xl font-bold text-emerald-600">
                      {halalProducts}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <button
                  onClick={openCreateModal}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition duration-200 flex items-center space-x-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  <span>Add Product</span>
                </button>
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse"
                  >
                    <div className="w-full h-48 bg-gray-200 rounded-lg mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-4"></div>
                    <div className="flex justify-between items-center">
                      <div className="h-6 bg-gray-200 rounded w-20"></div>
                      <div className="h-8 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                ))
              ) : filteredProducts.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <svg
                    className="w-16 h-16 text-gray-300 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No products found
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Get started by creating your first product.
                  </p>
                  <button
                    onClick={openCreateModal}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition duration-200"
                  >
                    Create Product
                  </button>
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const daysLeft = calculateDaysLeft(product.expirationDate);
                  return (
                    <div
                      key={product.$id}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="relative">
                        <img
                          src={
                            product.productImage ||
                            "/placeholder.svg?height=200&width=400"
                          }
                          alt={product.name}
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute top-4 right-4 flex gap-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              daysLeft < 0
                                ? "bg-red-100 text-red-800"
                                : daysLeft < 30
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {daysLeft < 0 ? "Expired" : `${daysLeft} days`}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              product.isHalal
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {product.isHalal ? "Halal" : "Not Halal"}
                          </span>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {product.name}
                          </h3>
                          <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full ml-2">
                            {product.category}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                          {product.description}
                        </p>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-2xl font-bold text-gray-900">
                            {product.price} sum
                          </span>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Expires</p>
                            <p className="text-sm font-medium text-gray-700">
                              {new Date(
                                product.expirationDate
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              setCurrentView("view");
                            }}
                            className="flex-1 px-3 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                          >
                            View
                          </button>
                          <button
                            onClick={() => openEditModal(product)}
                            className="flex-1 px-3 py-2 text-green-600 border border-green-600 rounded-lg hover:bg-green-50 transition-colors text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.$id)}
                            className="px-3 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </main>
        )}

        {/* Create/Edit Form */}
        {(currentView === "create" || currentView === "edit") && (
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Form Fields */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Product Name
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter product name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Category
                        </label>
                        <input
                          type="text"
                          value={formData.category}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              category: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter category"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        rows="4"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter product description"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Price (sum)
                        </label>
                        <input
                          type="number"
                          value={formData.price}
                          onChange={(e) =>
                            setFormData({ ...formData, price: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Expiration Date
                        </label>
                        <input
                          type="date"
                          value={formData.expirationDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              expirationDate: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Halal Status
                      </label>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="isHalal"
                            checked={formData.isHalal === true}
                            onChange={() =>
                              setFormData({ ...formData, isHalal: true })
                            }
                            className="w-4 h-4 text-emerald-600 border-gray-300 focus:ring-emerald-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Halal
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="isHalal"
                            checked={formData.isHalal === false}
                            onChange={() =>
                              setFormData({ ...formData, isHalal: false })
                            }
                            className="w-4 h-4 text-gray-600 border-gray-300 focus:ring-gray-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Not Halal
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Image
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, "productImage")}
                          className="hidden"
                          id="productImage"
                        />
                        <label
                          htmlFor="productImage"
                          className="cursor-pointer"
                        >
                          <svg
                            className="w-12 h-12 text-gray-400 mx-auto mb-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                          <p className="text-gray-600">
                            Click to upload product image
                          </p>
                          <p className="text-sm text-gray-400">
                            PNG, JPG, GIF up to 10MB
                          </p>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Certificate File
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) =>
                            handleFileChange(e, "certificateFile")
                          }
                          className="hidden"
                          id="certificateFile"
                        />
                        <label
                          htmlFor="certificateFile"
                          className="cursor-pointer"
                        >
                          <svg
                            className="w-12 h-12 text-gray-400 mx-auto mb-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <p className="text-gray-600">
                            Click to upload certificate
                          </p>
                          <p className="text-sm text-gray-400">
                            PDF, DOC, DOCX, JPG, PNG up to 10MB
                          </p>
                        </label>
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <button
                        onClick={() => {
                          setCurrentView("dashboard");
                          resetForm();
                        }}
                        className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={
                          currentView === "create"
                            ? handleCreateProduct
                            : handleUpdateProduct
                        }
                        disabled={loading}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition duration-200 font-medium disabled:opacity-50"
                      >
                        {loading ? (
                          <div className="flex items-center justify-center space-x-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>
                              {currentView === "create"
                                ? "Creating..."
                                : "Updating..."}
                            </span>
                          </div>
                        ) : currentView === "create" ? (
                          "Create Product"
                        ) : (
                          "Update Product"
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Preview Panel */}
                  <div className="lg:col-span-1">
                    <div className="sticky top-6 space-y-6">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Preview
                      </h3>

                      {/* Product Image Preview */}
                      {previewUrls.productImage && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Image
                          </label>
                          <div className="relative">
                            <img
                              src={
                                previewUrls.productImage || "/placeholder.svg"
                              }
                              alt="Product preview"
                              className="w-full h-48 object-cover rounded-lg border border-gray-200"
                            />
                            {formData.productImage && (
                              <div className="absolute top-2 right-2">
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                  New
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Certificate File Preview */}
                      {previewUrls.certificateFile && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Certificate File
                          </label>
                          <div className="border border-gray-200 rounded-lg p-4">
                            {previewUrls.certificateFile.includes(".pdf") ||
                            previewUrls.certificateFile.includes(".doc") ||
                            previewUrls.certificateFile.includes(".docx") ? (
                              <div className="flex items-center space-x-3">
                                <svg
                                  className="w-8 h-8 text-red-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">
                                    Document File
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {previewUrls.certificateFile.includes(
                                      ".pdf"
                                    )
                                      ? "PDF Document"
                                      : "Word Document"}
                                  </p>
                                </div>
                                <a
                                  href={previewUrls.certificateFile}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                    />
                                  </svg>
                                </a>
                              </div>
                            ) : (
                              <div className="relative">
                                <img
                                  src={
                                    previewUrls.certificateFile ||
                                    "/placeholder.svg"
                                  }
                                  alt="Certificate preview"
                                  className="w-full h-32 object-cover rounded border"
                                />
                                <a
                                  href={previewUrls.certificateFile}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-50"
                                >
                                  <svg
                                    className="w-4 h-4 text-gray-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                    />
                                  </svg>
                                </a>
                              </div>
                            )}
                            {formData.certificateFile && (
                              <div className="mt-2">
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                  New File Selected
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Product Info Preview */}
                      {(formData.name ||
                        formData.category ||
                        formData.price) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Info
                          </label>
                          <div className="border border-gray-200 rounded-lg p-4 space-y-2">
                            {formData.name && (
                              <div>
                                <span className="text-xs text-gray-500">
                                  Name:
                                </span>
                                <p className="font-medium">{formData.name}</p>
                              </div>
                            )}
                            {formData.category && (
                              <div>
                                <span className="text-xs text-gray-500">
                                  Category:
                                </span>
                                <p className="text-sm">{formData.category}</p>
                              </div>
                            )}
                            {formData.price > 0 && (
                              <div>
                                <span className="text-xs text-gray-500">
                                  Price:
                                </span>
                                <p className="text-sm font-semibold">
                                  {formData.price} sum
                                </p>
                              </div>
                            )}
                            <div>
                              <span className="text-xs text-gray-500">
                                Halal Status:
                              </span>
                              <span
                                className={`ml-2 text-xs px-2 py-1 rounded-full ${
                                  formData.isHalal
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {formData.isHalal ? "Halal" : "Not Halal"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* View Product Details */}
        {currentView === "view" && selectedProduct && (
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className="p-8">
                    <img
                      src={
                        selectedProduct.productImage ||
                        "/placeholder.svg?height=400&width=400"
                      }
                      alt={selectedProduct.name}
                      className="w-full h-64 object-cover rounded-lg"
                    />
                  </div>
                  <div className="p-8">
                    <div className="flex items-start justify-between mb-4">
                      <h2 className="text-3xl font-bold text-gray-900">
                        {selectedProduct.name}
                      </h2>
                      <div className="flex flex-col gap-2">
                        <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                          {selectedProduct.category}
                        </span>
                        <span
                          className={`text-sm px-3 py-1 rounded-full font-semibold ${
                            selectedProduct.isHalal
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {selectedProduct.isHalal ? "Halal" : "Not Halal"}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 mb-6">
                      {selectedProduct.description}
                    </p>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-3 border-b border-gray-200">
                        <span className="text-gray-600">Price</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {selectedProduct.price} sum
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-3 border-b border-gray-200">
                        <span className="text-gray-600">Status</span>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            calculateDaysLeft(selectedProduct.expirationDate) <
                            0
                              ? "bg-red-100 text-red-800"
                              : calculateDaysLeft(
                                  selectedProduct.expirationDate
                                ) < 30
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {calculateDaysLeft(selectedProduct.expirationDate) < 0
                            ? "Expired"
                            : `${calculateDaysLeft(
                                selectedProduct.expirationDate
                              )} days left`}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-3 border-b border-gray-200">
                        <span className="text-gray-600">Halal Status</span>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            selectedProduct.isHalal
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {selectedProduct.isHalal
                            ? "Halal Certified"
                            : "Not Halal"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-3 border-b border-gray-200">
                        <span className="text-gray-600">Created</span>
                        <span className="text-gray-900">
                          {new Date(
                            selectedProduct.createdDate
                          ).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-3 border-b border-gray-200">
                        <span className="text-gray-600">Expires</span>
                        <span className="text-gray-900">
                          {new Date(
                            selectedProduct.expirationDate
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="mt-8 space-y-4">
                      {selectedProduct.qrCodeUrl && (
                        <div className="text-center">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            QR Code
                          </h3>
                          <img
                            src={
                              selectedProduct.qrCodeUrl || "/placeholder.svg"
                            }
                            alt="QR Code"
                            className="w-32 h-32 mx-auto border rounded-lg"
                          />
                        </div>
                      )}

                      {selectedProduct.certificateFile && (
                        <div className="text-center">
                          <a
                            href={selectedProduct.certificateFile}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <span>View Certificate</span>
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="mt-8 flex space-x-4">
                      <button
                        onClick={() => setCurrentView("dashboard")}
                        className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      >
                        Back to Dashboard
                      </button>
                      <button
                        onClick={() => openEditModal(selectedProduct)}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Edit Product
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

export default App;
