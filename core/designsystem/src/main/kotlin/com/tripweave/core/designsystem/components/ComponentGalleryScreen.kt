package com.tripweave.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.tripweave.core.designsystem.theme.*
import com.tripweave.core.model.FeasibilityLevel
import com.tripweave.core.model.PriceSourceType

@Composable
fun ComponentGalleryScreen(
    modifier: Modifier = Modifier
) {
    var selectedScenario by remember { mutableStateOf("typical") }
    var duration by remember { mutableStateOf(60) }
    var selectedLang by remember { mutableStateOf("en") }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        item {
            Text(
                text = "TripWeave Component Gallery",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Spec v3: Soft Tonal Material You Tokens & Components",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        item {
            Text(text = "1. SearchPill", style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(8.dp))
            SearchPill(hint = "Search places, food, fuel, stays...")
        }

        item {
            Text(text = "2. FeasibilityRing & FeasibilityPill", style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                FeasibilityPill(
                    feasibilityLevel = FeasibilityLevel.FEASIBLE,
                    timePercent = 45f,
                    budgetPercent = 60f,
                    label = "Feasible"
                )
                FeasibilityPill(
                    feasibilityLevel = FeasibilityLevel.TIGHT,
                    timePercent = 85f,
                    budgetPercent = 92f,
                    label = "Tight"
                )
                FeasibilityPill(
                    feasibilityLevel = FeasibilityLevel.INFEASIBLE,
                    timePercent = 110f,
                    budgetPercent = 105f,
                    label = "Not Feasible"
                )
            }
        }

        item {
            Text(text = "3. Confidence Chips (Data Provenance)", style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ConfidenceChip(sourceType = PriceSourceType.OFFICIAL)
                ConfidenceChip(sourceType = PriceSourceType.CALCULATED)
                ConfidenceChip(sourceType = PriceSourceType.USER_ENTERED)
                ConfidenceChip(sourceType = PriceSourceType.DEMO)
            }
        }

        item {
            Text(text = "4. ScenarioSwitch", style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(8.dp))
            ScenarioSwitch(
                selectedScenario = selectedScenario,
                onScenarioSelected = { selectedScenario = it }
            )
        }

        item {
            Text(text = "5. DurationStepper", style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(8.dp))
            DurationStepper(
                durationMinutes = duration,
                onDurationChange = { duration = it }
            )
        }

        item {
            Text(text = "6. LanguageCards", style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(8.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                LanguageCard(
                    code = "en",
                    nativeName = "English",
                    englishName = "English",
                    isSelected = selectedLang == "en",
                    onClick = { selectedLang = "en" }
                )
                LanguageCard(
                    code = "te",
                    nativeName = "తెలుగు",
                    englishName = "Telugu",
                    isSelected = selectedLang == "te",
                    onClick = { selectedLang = "te" }
                )
                LanguageCard(
                    code = "hi",
                    nativeName = "हिन्दी",
                    englishName = "Hindi",
                    isSelected = selectedLang == "hi",
                    onClick = { selectedLang = "hi" }
                )
                LanguageCard(
                    code = "ta",
                    nativeName = "தமிழ்",
                    englishName = "Tamil",
                    isSelected = selectedLang == "ta",
                    onClick = { selectedLang = "ta" }
                )
            }
        }
    }
}
