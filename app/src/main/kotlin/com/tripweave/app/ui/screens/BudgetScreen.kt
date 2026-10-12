package com.tripweave.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tripweave.app.ui.MainViewModel
import com.tripweave.core.designsystem.R
import com.tripweave.core.designsystem.components.ConfidenceChip
import com.tripweave.core.model.CategoryBudget
import com.tripweave.core.model.PriceSourceType
import kotlin.math.roundToInt

@Composable
fun BudgetScreen(
    viewModel: MainViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val budgetResult = uiState.budgetResult
    val trip = uiState.activeTrip

    var selectedScenario by remember { mutableStateOf("Typical") }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(
            text = stringResource(R.string.nav_budget),
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Transparent calculations with full source provenance",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(16.dp))

        if (budgetResult != null && trip != null) {
            // Main Cost & Remaining Banner
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.primaryContainer,
                tonalElevation = 2.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = stringResource(R.string.budget_total_cost),
                                style = MaterialTheme.typography.labelMedium
                            )
                            val displayAmount = when (selectedScenario) {
                                "Low" -> budgetResult.lowScenarioCost
                                "High" -> budgetResult.highScenarioCost
                                else -> budgetResult.totalCost
                            }
                            Text(
                                text = "₹${displayAmount.roundToInt()}",
                                style = MaterialTheme.typography.displayLarge,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = stringResource(R.string.budget_per_person, "₹${(budgetResult.perPersonCost).roundToInt()}"),
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = if (budgetResult.isOverBudget) {
                                    stringResource(R.string.budget_overrun, "₹${(-budgetResult.budgetRemaining).roundToInt()}")
                                } else {
                                    stringResource(R.string.budget_remaining, "₹${budgetResult.budgetRemaining.roundToInt()}")
                                },
                                color = if (budgetResult.isOverBudget) Color(0xFFC2410C) else Color(0xFF2D7F5E),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Progress bar
                    val ratio = (budgetResult.totalCost / trip.totalBudget.coerceAtLeast(1.0)).toFloat().coerceIn(0f, 1f)
                    LinearProgressIndicator(
                        progress = { ratio },
                        modifier = Modifier.fillMaxWidth().height(8.dp),
                        color = if (budgetResult.isOverBudget) Color(0xFFC2410C) else MaterialTheme.colorScheme.primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Low / Typical / High Segmented Selector
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilledTonalButton(
                    onClick = { selectedScenario = "Low" },
                    colors = ButtonDefaults.filledTonalButtonColors(
                        containerColor = if (selectedScenario == "Low") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                        contentColor = if (selectedScenario == "Low") Color.White else MaterialTheme.colorScheme.onSurface
                    ),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(stringResource(R.string.scenario_low))
                }
                FilledTonalButton(
                    onClick = { selectedScenario = "Typical" },
                    colors = ButtonDefaults.filledTonalButtonColors(
                        containerColor = if (selectedScenario == "Typical") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                        contentColor = if (selectedScenario == "Typical") Color.White else MaterialTheme.colorScheme.onSurface
                    ),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(stringResource(R.string.scenario_typical))
                }
                FilledTonalButton(
                    onClick = { selectedScenario = "High" },
                    colors = ButtonDefaults.filledTonalButtonColors(
                        containerColor = if (selectedScenario == "High") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                        contentColor = if (selectedScenario == "High") Color.White else MaterialTheme.colorScheme.onSurface
                    ),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(stringResource(R.string.scenario_high))
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Category Breakdown List
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(budgetResult.categoryBreakdown) { cat ->
                    CategoryBudgetCard(cat)
                }
            }
        }
    }
}

@Composable
fun CategoryBudgetCard(cat: CategoryBudget) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = cat.category.name.replace("_", " "),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "${cat.itemCount} items • ₹${cat.perPersonAmount.roundToInt()}/person",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "₹${cat.totalAmount.roundToInt()}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                ConfidenceChip(
                    sourceType = if (cat.category.name == "FUEL") PriceSourceType.CALCULATED else PriceSourceType.OFFICIAL
                )
            }
        }
    }
}
