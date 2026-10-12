package com.tripweave.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.tripweave.app.ui.MainViewModel
import com.tripweave.core.designsystem.components.ConfidenceChip
import com.tripweave.core.model.PriceSourceType
import com.tripweave.core.model.TripStop

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StopDetailSheet(
    stop: TripStop,
    viewModel: MainViewModel,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Text(
                text = stop.name,
                style = MaterialTheme.typography.headlineSmall
            )
            Spacer(modifier = Modifier.height(4.dp))
            stop.notes?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Duration & Buffer Controls
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Visit Duration: ${stop.plannedDurationMinutes}m")
                Row {
                    FilledTonalButton(onClick = { viewModel.updateStopDuration(stop, -15) }) { Text("-15m") }
                    Spacer(modifier = Modifier.width(4.dp))
                    FilledTonalButton(onClick = { viewModel.updateStopDuration(stop, 15) }) { Text("+15m") }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Buffer Time: ${stop.bufferMinutes}m")
                Row {
                    FilledTonalButton(onClick = { viewModel.updateStopBuffer(stop, -5) }) { Text("-5m") }
                    Spacer(modifier = Modifier.width(4.dp))
                    FilledTonalButton(onClick = { viewModel.updateStopBuffer(stop, 5) }) { Text("+5m") }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Provenance
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ConfidenceChip(sourceType = PriceSourceType.OFFICIAL)
                ConfidenceChip(sourceType = PriceSourceType.DEMO)
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Done")
            }
        }
    }
}
