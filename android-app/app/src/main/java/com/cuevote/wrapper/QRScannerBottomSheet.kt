package com.cuevote.wrapper

import android.Manifest
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.journeyapps.barcodescanner.BarcodeCallback
import com.journeyapps.barcodescanner.BarcodeResult
import com.journeyapps.barcodescanner.DecoratedBarcodeView

class QRScannerBottomSheet : BottomSheetDialogFragment() {

    interface QRScanListener {
        fun onScanComplete(url: String)
        fun onScanCancelled()
    }

    private lateinit var barcodeView: DecoratedBarcodeView
    private var listener: QRScanListener? = null

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            barcodeView.resume()
        } else {
            Toast.makeText(context, "Camera permission required to scan QR codes", Toast.LENGTH_LONG).show()
            dismiss()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (activity is QRScanListener) {
            listener = activity as QRScanListener
        }
        // Transparent background for rounded corners to show
        setStyle(STYLE_NORMAL, R.style.TransparentBottomSheetDialog)
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        // Inflate the layout for this fragment
        return inflater.inflate(R.layout.layout_qr_bottom_sheet, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        barcodeView = view.findViewById(R.id.barcode_scanner)
        
        // QR Code Decoding Callback
        barcodeView.decodeContinuous(object : BarcodeCallback {
            override fun barcodeResult(result: BarcodeResult?) {
                result?.text?.let { text ->
                    // Beep or Vibrate here if needed (DecoratedBarcodeView handles some default)
                    listener?.onScanComplete(text)
                    dismiss()
                }
            }
            override fun possibleResultPoints(resultPoints: MutableList<com.google.zxing.ResultPoint>?) {}
        })

        // Permission Check
        if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            barcodeView.resume()
        } else {
            requestPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    override fun onStart() {
        super.onStart()
        val dialog = dialog as? BottomSheetDialog
        val bottomSheet = dialog?.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)
        
        bottomSheet?.let { sheet ->
            val behavior = BottomSheetBehavior.from(sheet)
            val displayMetrics = resources.displayMetrics
            val height = displayMetrics.heightPixels
            val orientation = resources.configuration.orientation
            
            // HEIGHT LOGIC: 80% Portrait, 85% Landscape
            val percent = if (orientation == Configuration.ORIENTATION_LANDSCAPE) 0.85 else 0.80
            val targetHeight = (height * percent).toInt()
            
            // Force Height
            val layoutParams = sheet.layoutParams
            layoutParams.height = targetHeight
            sheet.layoutParams = layoutParams
            
            behavior.state = BottomSheetBehavior.STATE_EXPANDED
            behavior.peekHeight = targetHeight
            
            // Allow Swipe Down to Dismiss
            behavior.isHideable = true
            behavior.skipCollapsed = true
        }
    }

    override fun onResume() {
        super.onResume()
        if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            barcodeView.resume()
        }
    }

    override fun onPause() {
        super.onPause()
        barcodeView.pause()
    }
}
