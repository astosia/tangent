#include <pebble.h>
#include "month.h"
#include "string.h"

const char* MONTH_ES[] = {
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
};
const char* MONTH_EN[] = {
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
};
const char* MONTH_DE[] = {
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAI",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OKT",
  "NOV",
  "DEZ",
};
const char* MONTH_FR[] = {
  "JAN",
  "FEV",
  "MAR",
  "AVR",
  "MAI",
  "JUN",
  "JUL",
  "AOU",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
};
const char* MONTH_PT[] = {
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
};
const char* MONTH_IT[] = {
  "GEN",
  "FEB",
  "MAR",
  "APR",
  "MAG",
  "GIU",
  "LUG",
  "AGO",
  "SET",
  "OTT",
  "NOV",
  "DIC",
};

void fetchmonth(int MM, const char* lang, char *itermonth) {
  if (strcmp(lang,"es_ES")==0) {strcpy(itermonth, MONTH_ES[MM]);}
  else if (strcmp(lang,"fr_FR")==0) {strcpy(itermonth, MONTH_FR[MM]);}
  else if (strcmp(lang,"de_DE")==0) {strcpy(itermonth, MONTH_DE[MM]);}
  else if (strcmp(lang,"it_IT")==0) {strcpy(itermonth, MONTH_IT[MM]);}
  else if (strcmp(lang,"pt_PT")==0) {strcpy(itermonth, MONTH_PT[MM]);}
  else {strcpy(itermonth, MONTH_EN[MM]);}
}
