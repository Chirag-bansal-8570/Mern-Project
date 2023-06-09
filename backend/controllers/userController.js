const User = require("../models/userModel");
const ErrorHandler = require("../utils/errorhandler");
const catchAsyncError = require("../middleware/catchAsyncError");
const sendToken = require("../utils/jwtToken");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const cloudinary = require("cloudinary");

// Register a User
exports.registerUser = catchAsyncError(async(req, res, next)=> {

    const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
        folder: "avatars",
        width: 150,
        crop: "scale",
    });

    const {name, email, password} = req.body;
    const user = await User.create({
        name,
        email,
        password,
        avatar: {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
        }
    });

    sendToken(user, 201, res);

});

// Login a User
exports.loginUser = catchAsyncError(async (req, res, next)=> {
   
    const {email, password} = req.body;

    // checking if user has given password and email both
    if(!email || !password) {
        return next(new ErrorHandler("Please Enter Email & Password", 400));
    }

    const user = await User.findOne({ email }).select("+password");

    if(!user) {
        return next(new ErrorHandler("Invalid Email or Password", 401));
    }

    const isPasswordMatched = await user.comparePassword(password);

    if(!isPasswordMatched) {
        return next(new ErrorHandler("Invalid Email or Password", 401));
    }

    sendToken(user, 200, res);

});

// Logout a User
exports.logout = catchAsyncError(async(req, res, next) => {

    res.cookie("token", null, {
        expires: new Date(Date.now()),
        httpOnly: true
    });

    res.status(200).json({
        success: true,
        message: "Logged Out",
    });

});

// Forgot Password
exports.forgotPassword = catchAsyncError(async(req, res, next) => {
    
    const user = await User.findOne({email: req.body.email});
    if(!user) {
        next(new ErrorHandler('User not found', 404));
    }

    // Get ResetPassword Token
    const resetToken = await user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    const resetPasswordUrl = `${req.protocol}://${req.get("host")}/api/v1/password/reset/${resetToken}`;

    const message = ` Your password reset token is :- \n\n ${resetPasswordUrl} \n\nif you have not requested this email then, please ignore it `;

    try {

        await sendEmail({
            email: user.email,
            subject: `Ecommerce Password Recovery`,
            message,
        });

        res.status(200).json({
            success: true,
            message: `Email sent to ${user.email} successfully`,
        })
        
    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save({ validateBeforeSave: false });

        return next(new ErrorHandler(error.message, 500));
    }

});

// Reset password
exports.resetPassword = catchAsyncError(async (req, res, next) => {

    // Creating token hash
    const resetPasswordToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: {$gt: Date.now()}
    });

    if(!user) {
        return next(new ErrorHandler("Reset Password Token is invalid or has been expired", 400));
    }

    if(req.body.password !== req.body.confirmPassword) {
        return next(new ErrorHandler("Password does not matched", 400));
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    sendToken(user, 200, res);

});

// Get User Detail
exports.getUserDetails = catchAsyncError(async(req, res, next) => {

    const user = await User.findById(req.user.id);
    
    res.status(200).json({
        success: true,
        user,
    });

});

// Update User Password
exports.updatePassword = catchAsyncError(async(req, res, next) => {
    const user = await User.findById(req.user.id).select("+password");

    const isPasswordMatched = await user.comparePassword(req.body.oldPassword);

    if(!isPasswordMatched) {
        return next(new ErrorHandler("Old password is incorrect", 400));
    }

    if(req.body.newPassword !== req.body.confirmPassword) {
        return next(new ErrorHandler("Password does not match", 400));
    }

    user.password = req.body.newPassword;

    await user.save();

    sendToken(user, 200, res);

});

// Update User Profile
exports.updateProfile = catchAsyncError(async(req, res, next) => {

    const newUserData = {
        name: req.body.name,
        email: req.body.email
    };

    // We will add cloudinary later

    const user = await User.findByIdAndUpdate(req.user.id, newUserData, {
        new: true,
        runValidators: true,
        useFindAndModify: false
    });

    res.status(200).json({
        success: true,
    });

});

// Get all Users -- (admin)
exports.getAllUser = catchAsyncError(async(req, res, next) => {

    const users = await User.find();

    res.status(200).json({
        success: true,
        users,
    });

});

// Get single user -- (admin)
exports.getSingleUser = catchAsyncError(async(req, res, next) => {

    const user = await User.findById(req.params.id);

    if(!user) {
        return next(new ErrorHandler(`User does not exist with Id: ${req.params.id}`, 401));
    }

    res.status(200).json({
        success: true,
        user,
    });

});

// Update User Role -- (admin)
exports.updateUserRole = catchAsyncError(async(req, res, next) => {

    const newUserData = {
        name: req.body.name,
        email: req.body.email,
        role: req.body.role,
    };

    const user = await User.findByIdAndUpdate(req.params.id, newUserData, {
        new: true,
        runValidators: true,
        useFindAndModify: false
    });

    res.status(200).json({
        success: true,
    });

});

// Delete User -- (admin)
exports.deleteUser = catchAsyncError(async(req, res, next) => {

    const user = await User.findById(req.params.id);

    // We will remove cloudinary

    if(!user) {
        return next(new ErrorHandler(`User does not exist with Id: ${req.params.id}`, 401));
    }

    await user.deleteOne({ id: req.params.id });

    res.status(200).json({
        success: true,
        message: "User Deleted Successfully",
    });

});