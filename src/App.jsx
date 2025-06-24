"use client";

import { useState, useEffect } from "react";
import { Client, Account, Databases, Storage } from "appwrite";
import QRCode from "qrcode";
import {
  Eye,
  Edit,
  Trash2,
  Plus,
  LogOut,
  Search,
  Filter,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { Card, CardContent } from "./components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";
import { Badge } from "./components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";

const client = new Client();
client
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("6763fe500006de594234");

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);

// Predefined categories
const CATEGORIES = [
  "Beverages",
  "Dairy Products",
  "Meat & Poultry",
  "Seafood",
  "Fruits",
  "Vegetables",
  "Grains & Cereals",
  "Snacks",
  "Desserts",
  "Condiments",
  "Frozen Foods",
  "Bakery",
  "Other",
];

export default function Dashboard() {
  const [currentView, setCurrentView] = useState("login");
  const [authData, setAuthData] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    expirationDate: "",
    isHalal: false,
    alternative: "none", // Will store product ID of alternative product
    productImage: null,
    certificateFile: null,
    // Nutrition fields
    carbohydrates: "",
    proteins: "",
    fats: "",
    alcohol: "",
  });
  const [previewUrls, setPreviewUrls] = useState({
    productImage: null,
    certificateFile: null,
  });

  useEffect(() => {
    checkSession();
    fetchProducts();
  }, []);

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

  const handleLogout = async () => {
    try {
      await account.deleteSession("current");
      setUser(null);
      setCurrentView("login");
    } catch (error) {
      console.error("Logout failed:", error);
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
      setCurrentView("login");
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

  const calculateDaysLeft = (expirationDate) => {
    const today = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Calculate total kcal automatically
  const calculateTotalKcal = (carbs, proteins, fats, alcohol) => {
    const c = Number.parseFloat(carbs) || 0;
    const p = Number.parseFloat(proteins) || 0;
    const f = Number.parseFloat(fats) || 0;
    const a = Number.parseFloat(alcohol) || 0;
    return c * 4 + p * 4 + f * 9 + a * 7;
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
      // Validate file types
      if (fieldName === "productImage") {
        const validImageTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/gif",
          "image/webp",
        ];
        if (!validImageTypes.includes(file.type)) {
          alert("Please select a valid image file (JPEG, PNG, GIF, WebP)");
          return;
        }
      }

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
    // Add validation checks here
    if (
      !formData.name ||
      !formData.description ||
      !formData.price ||
      !formData.category ||
      !formData.expirationDate
    ) {
      alert(
        "Please fill in all required product fields: Name, Description, Price, Category, and Expiration Date."
      );
      return; // Stop the function if validation fails
    }

    setLoading(true);
    try {
      const productId = new Date().getTime().toString();
      const createdDate = new Date().toISOString();

      // Convert date input to ISO format for storage
      const expirationDateISO = formData.expirationDate
        ? new Date(formData.expirationDate + "T00:00:00.000Z").toISOString()
        : new Date().toISOString();

      const totalKcal = calculateTotalKcal(
        formData.carbohydrates,
        formData.proteins,
        formData.fats,
        formData.alcohol
      );

      // Upload product image if provided
      let productImageUrl = "";
      if (formData.productImage) {
        productImageUrl = await handleFileUpload(
          formData.productImage,
          `product_${productId}`
        );
      }

      // Upload certificate file if provided
      let certificateFileUrl = "";
      if (formData.certificateFile) {
        certificateFileUrl = await handleFileUpload(
          formData.certificateFile,
          `cert_${productId}`
        );
      }

      // Generate QR Code
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
      const alternativeValueToSave =
        formData.alternative === "none" ? "" : formData.alternative;

      // Create product document
      const newProduct = await databases.createDocument(
        "676400030013c65fde49",
        "676400490003acf4906a",
        "unique()",
        {
          name: formData.name,
          description: formData.description,
          price: Number.parseFloat(formData.price) || 0,
          category: formData.category,
          alternative: alternativeValueToSave, // Store product ID
          productId: productId,
          qrCodeUrl: qrCodeFileUrl,
          productUrl: `https://ar-qr-admin.netlify.app/product/${productId}`,
          productImage: productImageUrl,
          certificateFile: certificateFileUrl,
          createdDate: createdDate,
          expirationDate: expirationDateISO,
          isHalal: formData.isHalal,
          carbohydrates: Number.parseFloat(formData.carbohydrates) || 0,
          proteins: Number.parseFloat(formData.proteins) || 0,
          fats: Number.parseFloat(formData.fats) || 0,
          alcohol: Number.parseFloat(formData.alcohol) || 0,
          totalKcal: totalKcal,
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
    // Add validation checks here
    if (
      !formData.name ||
      !formData.description ||
      !formData.price ||
      !formData.category ||
      !formData.expirationDate
    ) {
      alert(
        "Please fill in all required product fields: Name, Description, Price, Category, and Expiration Date."
      );
      return; // Stop the function if validation fails
    }

    setLoading(true);
    try {
      let productImageUrl = selectedProduct.productImage;
      let certificateFileUrl = selectedProduct.certificateFile;

      // Convert date input to ISO format for storage
      const expirationDateISO = formData.expirationDate
        ? new Date(formData.expirationDate + "T00:00:00.000Z").toISOString()
        : selectedProduct.expirationDate;

      const totalKcal = calculateTotalKcal(
        formData.carbohydrates,
        formData.proteins,
        formData.fats,
        formData.alcohol
      );

      // Upload new files if provided
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
      const alternativeValueToSave =
        formData.alternative === "none" ? "" : formData.alternative;

      const updatedProduct = await databases.updateDocument(
        "676400030013c65fde49",
        "676400490003acf4906a",
        selectedProduct.$id,
        {
          name: formData.name,
          description: formData.description,
          price: Number.parseFloat(formData.price) || 0,
          category: formData.category,
          alternative: alternativeValueToSave, // Store product ID
          expirationDate: expirationDateISO,
          isHalal: formData.isHalal,
          carbohydrates: Number.parseFloat(formData.carbohydrates) || 0,
          proteins: Number.parseFloat(formData.proteins) || 0,
          fats: Number.parseFloat(formData.fats) || 0,
          alcohol: Number.parseFloat(formData.alcohol) || 0,
          totalKcal: totalKcal,
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
      price: "",
      category: "",
      expirationDate: "",
      isHalal: false,
      alternative: "none",
      productImage: null,
      certificateFile: null,
      carbohydrates: "",
      proteins: "",
      fats: "",
      alcohol: "",
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
        const date = new Date(isoDate);
        if (isNaN(date.getTime())) return "";

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
      price: product.price ? product.price.toString() : "",
      category: product.category || "",
      alternative: product.alternative || "none",
      expirationDate: formatDateForInput(product.expirationDate),
      isHalal: product.isHalal || false,
      carbohydrates: product.carbohydrates
        ? product.carbohydrates.toString()
        : "",
      proteins: product.proteins ? product.proteins.toString() : "",
      fats: product.fats ? product.fats.toString() : "",
      alcohol: product.alcohol ? product.alcohol.toString() : "",
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

  const openViewModal = (product) => {
    setSelectedProduct(product);
    setCurrentView("view");
  };

  // Get alternative product name
  const getAlternativeProductName = (alternativeId) => {
    if (!alternativeId) return "None";
    const altProduct = products.find((p) => p.$id === alternativeId);
    return altProduct ? altProduct.name : "Unknown Product";
  };

  // Enhanced filtering with status filter
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;

    // Status filtering
    let matchesStatus = true;
    if (statusFilter !== "all") {
      const daysLeft = calculateDaysLeft(product.expirationDate);
      switch (statusFilter) {
        case "valid":
          matchesStatus = daysLeft > 30;
          break;
        case "expiring":
          matchesStatus = daysLeft >= 0 && daysLeft <= 30;
          break;
        case "expired":
          matchesStatus = daysLeft < 0;
          break;
        case "halal":
          matchesStatus = product.isHalal === true;
          break;
      }
    }

    return matchesSearch && matchesCategory && matchesStatus;
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
  const validProducts = products.filter(
    (p) => calculateDaysLeft(p.expirationDate) > 30
  ).length;
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

  // Dashboard View
  if (currentView === "dashboard") {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-blue-600">
                U-White Dashboard
              </h1>
              <p className="text-gray-600">Welcome back, {user.name}</p>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="flex items-center gap-2 text-red-600 hover:text-red-700"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>

          {/* Clickable Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                statusFilter === "all" ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() =>
                setStatusFilter(statusFilter === "all" ? "all" : "all")
              }
            >
              <CardContent className="p-6">
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
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                statusFilter === "valid" ? "ring-2 ring-green-500" : ""
              }`}
              onClick={() =>
                setStatusFilter(statusFilter === "valid" ? "all" : "valid")
              }
            >
              <CardContent className="p-6">
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
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                statusFilter === "expiring" ? "ring-2 ring-yellow-500" : ""
              }`}
              onClick={() =>
                setStatusFilter(
                  statusFilter === "expiring" ? "all" : "expiring"
                )
              }
            >
              <CardContent className="p-6">
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
                    <AlertTriangle className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                statusFilter === "expired" ? "ring-2 ring-red-500" : ""
              }`}
              onClick={() =>
                setStatusFilter(statusFilter === "expired" ? "all" : "expired")
              }
            >
              <CardContent className="p-6">
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
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"
                      />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                statusFilter === "halal" ? "ring-2 ring-emerald-500" : ""
              }`}
              onClick={() =>
                setStatusFilter(statusFilter === "halal" ? "all" : "halal")
              }
            >
              <CardContent className="p-6">
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
              </CardContent>
            </Card>
          </div>

          {/* Active Filter Indicator */}
          {statusFilter !== "all" && (
            <div className="mb-4">
              <Badge variant="secondary" className="text-sm">
                Filtered by:{" "}
                {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}{" "}
                Products
                <button
                  onClick={() => setStatusFilter("all")}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </Badge>
            </div>
          )}

          {/* Filters and Search */}
          <Card className="mb-6">
            <CardContent className="px-6">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-48 bg-white text-gray-600">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={openCreateModal}
                  className="flex items-center gap-2 text-green-600 hover:text-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="w-full h-48 bg-gray-200 rounded-lg mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-4"></div>
                    <div className="flex justify-between items-center">
                      <div className="h-6 bg-gray-200 rounded w-20"></div>
                      <div className="h-8 bg-gray-200 rounded w-16"></div>
                    </div>
                  </CardContent>
                </Card>
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
                <Button onClick={openCreateModal} className="px-6 py-3">
                  Create Product
                </Button>
              </div>
            ) : (
              filteredProducts.map((product) => {
                const daysLeft = calculateDaysLeft(product.expirationDate);
                return (
                  <Card
                    key={product.$id}
                    className="overflow-hidden hover:shadow-md transition-shadow pt-0"
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
                    <CardContent className="p-6 py-0">
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
                        <span className="text-2xl font-bold text-emerald-500">
                          {product.price
                            .toString()
                            .replace(/\B(?=(\d{3})+(?!\d))/g, " ")}{" "}
                          UZS
                        </span>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Expires</p>
                          <p className="text-sm font-medium text-gray-500">
                            {new Date(
                              product.expirationDate
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openViewModal(product)}
                          className="flex-1 text-indigo-600 hover:text-indigo-700"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(product)}
                          className="flex-1 text-blue-600 hover:text-blue-700"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteProduct(product.$id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // Create/Edit/View Form Pages
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCurrentView("dashboard");
                resetForm();
              }}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </div>
          <div className="">
            <h1 className="text-2xl font-bold text-center text-blue-600">
              {currentView === "create" && "Add New Product"}
              {currentView === "edit" && "Edit Product"}
              {currentView === "view" && "Product Details"}
            </h1>
            <p className="text-gray-5 00">
              {currentView === "create" && "Create a new product with QR code"}
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

      {/* Form Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {(currentView === "create" || currentView === "edit") && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Fields */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Name
                      </Label>
                      <Input
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
                      <Label className="block text-sm font-medium text-gray-700 mb-2">
                        Category
                      </Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) =>
                          setFormData({ ...formData, category: value })
                        }
                      >
                        <SelectTrigger className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </Label>
                    <Textarea
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

                  {/* Alternative Product Dropdown */}
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Alternative Product
                    </Label>
                    <Select
                      value={formData.alternative}
                      onValueChange={(value) =>
                        setFormData({ ...formData, alternative: value })
                      }
                    >
                      <SelectTrigger className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                        <SelectValue placeholder="Select alternative product (optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="none">No Alternative</SelectItem>
                        {products
                          .filter((p) => p.$id !== selectedProduct?.$id) // Don't show current product as alternative
                          .map((product) => (
                            <SelectItem key={product.$id} value={product.$id}>
                              {product.name} - {product.category}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">
                        Price (UZS)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData({ ...formData, price: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter price"
                      />
                    </div>
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiration Date
                      </Label>
                      <Input
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

                  {/* Nutrition Information */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="text-lg font-semibold">
                      Nutrition Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">
                          Carbohydrates (g)
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={formData.carbohydrates}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              carbohydrates: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter carbohydrates"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          4 kcal per gram
                        </p>
                      </div>
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">
                          Proteins (g)
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={formData.proteins}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              proteins: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter proteins"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          4 kcal per gram
                        </p>
                      </div>
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">
                          Fats (g)
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={formData.fats}
                          onChange={(e) =>
                            setFormData({ ...formData, fats: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter fats"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          9 kcal per gram
                        </p>
                      </div>
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">
                          Alcohol (g)
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={formData.alcohol}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              alcohol: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter alcohol"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          7 kcal per gram
                        </p>
                      </div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">
                        Total Calories:{" "}
                        <span className="text-lg font-bold">
                          {calculateTotalKcal(
                            formData.carbohydrates,
                            formData.proteins,
                            formData.fats,
                            formData.alcohol
                          )}{" "}
                          kcal
                        </span>
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Halal Status
                    </Label>
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
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Image
                    </Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={(e) => handleFileChange(e, "productImage")}
                        className="hidden"
                        id="productImage"
                      />
                      <label htmlFor="productImage" className="cursor-pointer">
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
                          JPEG, PNG, GIF, WebP up to 10MB
                        </p>
                      </label>
                    </div>
                  </div>

                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Certificate File
                    </Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange(e, "certificateFile")}
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
                    <Button
                      onClick={() => {
                        setCurrentView("dashboard");
                        resetForm();
                      }}
                      variant="outline"
                      className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={
                        currentView === "create"
                          ? handleCreateProduct
                          : handleUpdateProduct
                      }
                      disabled={loading}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:bg-blue-600 hover:to-purple-700 transition duration-200 font-medium disabled:opacity-50"
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
                    </Button>
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
                        <Label className="block text-sm font-medium text-gray-700 mb-2">
                          Product Image
                        </Label>
                        <div className="relative">
                          <img
                            src={previewUrls.productImage || "/placeholder.svg"}
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
                        <Label className="block text-sm font-medium text-gray-700 mb-2">
                          Certificate File
                        </Label>
                        <div className="border border-gray-200 rounded-lg p-4">
                          {previewUrls.certificateFile.includes(".pdf") ||
                          previewUrls.certificateFile.includes(".doc") ||
                          previewUrls.certificateFile.includes(".docx") ||
                          !previewUrls.certificateFile.startsWith("blob:") ? (
                            <div className="flex items-center space-x-3">
                              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                                <svg
                                  className="w-8 h-8 text-gray-600"
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
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  Document File
                                </p>
                                <p className="text-xs text-gray-500">
                                  {previewUrls.certificateFile.includes(".pdf")
                                    ? "PDF Document"
                                    : previewUrls.certificateFile.includes(
                                        ".doc"
                                      )
                                    ? "Word Document"
                                    : "Certificate File"}
                                </p>
                              </div>
                              {!previewUrls.certificateFile.startsWith(
                                "blob:"
                              ) && (
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
                              )}
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
                    {(formData.name || formData.category || formData.price) && (
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">
                          Product Info
                        </Label>
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
                          {formData.alternative && (
                            <div>
                              <span className="text-xs text-gray-500">
                                Alternative:
                              </span>
                              <p className="text-sm">
                                {getAlternativeProductName(
                                  formData.alternative
                                )}
                              </p>
                            </div>
                          )}
                          {formData.price && (
                            <div>
                              <span className="text-xs text-gray-500">
                                Price:
                              </span>
                              <p className="text-sm font-semibold">
                                {formData.price
                                  .toString()
                                  .replace(/\B(?=(\d{3})+(?!\d))/g, " ")}{" "}
                                UZS
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
                          <div>
                            <span className="text-xs text-gray-500">
                              Total Calories:
                            </span>
                            <p className="text-sm font-semibold">
                              {calculateTotalKcal(
                                formData.carbohydrates,
                                formData.proteins,
                                formData.fats,
                                formData.alcohol
                              )}{" "}
                              kcal
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Product Details */}
        {currentView === "view" && selectedProduct && (
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
                        {selectedProduct.price
                          .toString()
                          .replace(/\B(?=(\d{3})+(?!\d))/g, " ")}{" "}
                        UZS
                      </span>
                    </div>

                    {selectedProduct.alternative && (
                      <div className="flex justify-between items-center py-3 border-b border-gray-200">
                        <span className="text-gray-600">Alternative</span>
                        <span className="text-gray-900">
                          {getAlternativeProductName(
                            selectedProduct.alternative
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="text-gray-600">Status</span>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          calculateDaysLeft(selectedProduct.expirationDate) < 0
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

                    {/* Nutrition Information */}
                    <div className="py-3 border-b border-gray-200">
                      <span className="text-gray-600 block mb-2">
                        Nutrition
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Carbs: {selectedProduct.carbohydrates || 0}g</div>
                        <div>Protein: {selectedProduct.proteins || 0}g</div>
                        <div>Fat: {selectedProduct.fats || 0}g</div>
                        <div>Alcohol: {selectedProduct.alcohol || 0}g</div>
                      </div>
                      <div className="mt-2 font-semibold text-blue-600">
                        Total: {selectedProduct.totalKcal || 0} kcal
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 space-y-4">
                    {selectedProduct.qrCodeUrl && (
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          QR Code
                        </h3>
                        <img
                          src={selectedProduct.qrCodeUrl || "/placeholder.svg"}
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
                    <Button
                      onClick={() => setCurrentView("dashboard")}
                      variant="outline"
                      className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Back to Dashboard
                    </Button>
                    <Button
                      onClick={() => openEditModal(selectedProduct)}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Edit Product
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
