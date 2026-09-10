# NASA C-MAPSS Dataset Directory

Place raw C-MAPSS benchmark files here when available:
- `train_FD001.txt`
- `test_FD001.txt`
- `RUL_FD001.txt`
- `train_FD002.txt`
- `test_FD002.txt`
- `RUL_FD002.txt`
- `train_FD003.txt`
- `test_FD003.txt`
- `RUL_FD003.txt`
- `train_FD004.txt`
- `test_FD004.txt`
- `RUL_FD004.txt`
- `readme.txt`

Official NASA Source: https://data.nasa.gov/dataset/cmapss-jet-engine-simulated-data
Kaggle Distribution: https://www.kaggle.com/datasets/fareselgohary003/nasa-cmapss-turbofan-engine-rul-dataset

Note: C-MAPSS represents turbofan engine run-to-failure degradation data used for comparative RUL prognostics benchmarking.
Once files are present, trigger scan via API `/api/datasets/scan` or run `python scripts/run_training_pipeline.py`.
