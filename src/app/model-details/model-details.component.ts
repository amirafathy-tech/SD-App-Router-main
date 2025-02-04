import { Component, ViewChild } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ModelSpecDetailService } from './model-details.service';
import { ModelSpecDetails } from './model-details.model';
import { ModelEntity } from '../model/model.model';
import { Router } from '@angular/router';
import { ApiService } from '../shared/ApiService.service';
import { Subscription, forkJoin } from 'rxjs';
import { ServiceType } from '../service-type/service-type.model';
import { UnitOfMeasure } from '../models/unitOfMeasure.model';
import { PersonnelNumber } from '../models/personnelNumber.model';
import { Formula } from '../formulas/formulas.model';
import { ServiceMaster } from '../new-service-master/new-service-master.model';
import { main } from '@popperjs/core';
import * as FileSaver from 'file-saver';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-model-details',
  templateUrl: './model-details.component.html',
  styleUrls: ['./model-details.component.css'],
  providers: [ModelSpecDetailService, MessageService, ConfirmationService]
})
export class ModelDetailsComponent {

  subscription!: Subscription;
  records: ModelSpecDetails[] = [];
  public rowIndex = 0;
  searchTerm!: number;
  dontSelectServiceNumber: boolean = true
  modelSpecRecord?: ModelEntity // hold ModelSpecRecord from previous screen
  currency: any
  totalValue: number = 0.0

  displayImportsDialog = false;
  displayExcelDialog = false;
  //fields for dropdown lists
  recordsServiceNumber!: ServiceMaster[];
  selectedServiceNumberRecord?: ServiceMaster
  selectedServiceNumberRecordForExcel?: ServiceMaster
  selectedServiceNumber!: number;
  updateSelectedServiceNumber!: number
  updateSelectedServiceNumberRecord?: ServiceMaster
  shortText: string = '';
  updateShortText: string = '';
  shortTextChangeAllowed: boolean = false;
  updateShortTextChangeAllowed: boolean = false;
  recordsUnitOfMeasure!: UnitOfMeasure[];
  selectedUnitOfMeasure!: string;
  recordsServiceType!: ServiceType[];
  selectedServiceType!: string;
  recordsPersonnelNumber!: PersonnelNumber[];
  selectedPersonnelNumber!: string;
  recordsFormula!: any[];
  selectedFormula!: string;
  recordsMatGrp!: any[];
  selectedMatGrp!: string;
  recordsLineType!: any[];
  selectedLineType!: string;
  modelSpecDetailsCodes: number[] = []

  constructor(private apiService: ApiService, private router: Router, private modelSpecDetailsService: ModelSpecDetailService, private messageService: MessageService, private confirmationService: ConfirmationService,) {
    this.modelSpecRecord = this.router.getCurrentNavigation()?.extras.state?.['Record'];
    if (this.modelSpecRecord) {
      this.modelSpecDetailsCodes = this.modelSpecRecord.modelSpecDetailsCode
    }
    else {
      this.modelSpecRecord = undefined
    }
  }

  ngOnInit() {
    if (this.modelSpecRecord) {
      console.log(this.modelSpecRecord);

      const detailObservables = this.modelSpecRecord.modelSpecDetailsCode.map(code =>
        this.apiService.getID<ModelSpecDetails>('modelspecdetails', code)
      );
      forkJoin(detailObservables).subscribe(records => {
        this.records = records.sort((a, b) => b.modelSpecDetailsCode - a.modelSpecDetailsCode);
        // const filteredRecords = records.filter(record => record.deletionIndicator != true);
        this.totalValue = records.reduce((sum, record) => sum + record.netValue, 0);
        console.log('Total Value:', this.totalValue);
      });
    }
    this.apiService.get<ServiceMaster[]>('servicenumbers').subscribe(response => {
      this.recordsServiceNumber = response
      console.log(this.recordsServiceNumber);

      // .filter(record => record.deletionIndicator === false);
    });
    this.apiService.get<UnitOfMeasure[]>('measurements').subscribe(response => {
      this.recordsUnitOfMeasure = response;
      console.log(this.recordsUnitOfMeasure);

    });
    this.apiService.get<ServiceType[]>('servicetypes').subscribe(response => {
      this.recordsServiceType = response;
    });
    this.apiService.get<PersonnelNumber[]>('personnelnumbers').subscribe(response => {
      this.recordsPersonnelNumber = response;
    });
    this.apiService.get<any[]>('linetypes').subscribe(response => {
      this.recordsLineType = response;
    });
    this.apiService.get<any[]>('formulas').subscribe(response => {
      this.recordsFormula = response;
    });
    this.apiService.get<any[]>('materialgroups').subscribe(response => {
      this.recordsMatGrp = response;
      console.log(this.recordsMatGrp);
    });
  }

  // import from excel sheet:
  showImportsDialog() {
    this.displayImportsDialog = true;
  }
  showExcelDialog() {
    this.displayExcelDialog = true;
  }
  parsedData: ModelSpecDetails[] = []; // Parsed data from the Excel file
  displayedColumns: string[] = []; // Column headers from the Excel file

  onFileSelect(event: any, fileUploader: any) {
    console.log('Records before :', this.parsedData);
    const file = event.files[0];
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const binaryData = e.target.result;
      const workbook = XLSX.read(binaryData, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (jsonData.length > 0) {
        this.displayedColumns = jsonData[0].filter((col: any) => typeof col === 'string' && col.trim() !== '') as string[];
        this.parsedData = jsonData
          .slice(1) // Skip the header row
          .map((row: any[]) => {
            const rowData: any = {};
            this.displayedColumns.forEach((col, index) => {
              rowData[col] = row[index] !== undefined ? row[index] : '';
            });
            return rowData;
          })
        // .filter((rowData: any) => rowData.Type === 'Main Item'); // Filter only "Main Item" rows
        console.log('Filtered Records :', this.parsedData);
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Main Item records copied from the Excel sheet successfully!',
          life: 4000,
        });
      } else {
        this.displayedColumns = [];
        this.parsedData = [];
      }
      fileUploader.clear();
    };
    reader.readAsBinaryString(file);
  }
  // for selected from excel sheet:
  saveMainItemFromExcel(item: ModelSpecDetails) {
    console.log(item);
    if (this.selectedServiceNumberRecordForExcel && this.selectedFormulaRecordForExcel && this.resultAfterTest) { // if user select serviceNumber && select formula
      const newRecord = {
        serviceNumberCode: item.serviceNumberCode,
        lineTypeCode: item.lineTypeCode,
        unitOfMeasurementCode: this.selectedServiceNumberRecordForExcel.baseUnitOfMeasurement,
        currencyCode: this.modelSpecRecord?.currencyCode,
        personnelNumberCode: item.personnelNumberCode,
        serviceTypeCode: this.selectedServiceNumberRecordForExcel.serviceTypeCode,
        materialGroupCode: this.selectedServiceNumberRecordForExcel.materialGroupCode,
        formulaCode: item.formulaCode,
        shortText: this.selectedServiceNumberRecordForExcel.description,
        quantity: this.resultAfterTest,
        grossPrice: item.grossPrice,
        overFulfilmentPercentage: item.overFulfilmentPercentage,
        priceChangedAllowed: item.priceChangedAllowed,
        unlimitedOverFulfillment: item.unlimitedOverFulfillment,
        pricePerUnitOfMeasurement: item.pricePerUnitOfMeasurement,
        externalServiceNumber: item.externalServiceNumber,
        netValue: this.resultAfterTest * item.grossPrice,
        serviceText: this.selectedServiceNumberRecordForExcel.serviceText,
        lineText: item.lineText,
        lineNumber: item.lineNumber,
        alternatives: item.alternatives,
        biddersLine: item.biddersLine,
        supplementaryLine: item.supplementaryLine,
        lotSizeForCostingIsOne: item.lotSizeForCostingIsOne,
      }
      if (this.resultAfterTest === 0 || item.grossPrice === 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Quantity and GrossPrice are required',
          life: 3000
        });
      }
      console.log(newRecord);
      // Remove properties with empty or default values
      const filteredRecord = Object.fromEntries(
        Object.entries(newRecord).filter(([_, value]) => {
          return value !== '' && value !== 0 && value !== undefined && value !== null;
        })
      );
      console.log(filteredRecord);
      this.apiService.post<ModelSpecDetails>('modelspecdetails', filteredRecord).subscribe((response: ModelSpecDetails) => {
        console.log('modelspecdetails created:', response);
        if (response) {
          this.resetNewService();
          this.selectedFormulaRecordForExcel = undefined
          this.selectedServiceNumberRecordForExcel = undefined
          console.log(this.newService);

          const newDetail = response;
          if (this.modelSpecRecord) {
            this.modelSpecRecord.modelSpecDetailsCode.push(newDetail.modelSpecDetailsCode);
            this.apiService.put<ModelEntity>('modelspecs', this.modelSpecRecord.modelSpecCode, this.modelSpecRecord).subscribe(updatedModel => {
              console.log('Model updated:', updatedModel);
            });
          }
        }
        console.log(response);
        this.totalValue = 0;
        const index = this.parsedData.findIndex(item => item.modelSpecDetailsCode === item.modelSpecDetailsCode);
        if (index !== -1) {
          this.parsedData.splice(index, 1);
        }
        //this.modelSpecDetailsService.getRecords();
        this.ngOnInit()
      });
    }
    else if (this.selectedServiceNumberRecordForExcel && !this.selectedFormulaRecordForExcel && !this.resultAfterTest) { // if user select serviceNumber && didn't select formula
      const newRecord = {
        serviceNumberCode: item.serviceNumberCode,
        lineTypeCode: item.lineTypeCode,
        unitOfMeasurementCode: this.selectedServiceNumberRecordForExcel.baseUnitOfMeasurement,
        currencyCode: this.modelSpecRecord?.currencyCode,
        personnelNumberCode: item.personnelNumberCode,
        serviceTypeCode: this.selectedServiceNumberRecordForExcel.serviceTypeCode,
        materialGroupCode: this.selectedServiceNumberRecordForExcel.materialGroupCode,
        formulaCode: item.formulaCode,
        shortText: this.selectedServiceNumberRecordForExcel.description,
        quantity: item.quantity,
        grossPrice: item.grossPrice,
        overFulfilmentPercentage: item.overFulfilmentPercentage,
        priceChangedAllowed: item.priceChangedAllowed,
        unlimitedOverFulfillment: item.unlimitedOverFulfillment,
        pricePerUnitOfMeasurement: item.pricePerUnitOfMeasurement,
        externalServiceNumber: item.externalServiceNumber,
        netValue: item.quantity * item.grossPrice,
        serviceText: this.selectedServiceNumberRecordForExcel.serviceText,
        lineText: item.lineText,
        lineNumber: item.lineNumber,
        alternatives: item.alternatives,
        biddersLine: item.biddersLine,
        supplementaryLine: item.supplementaryLine,
        lotSizeForCostingIsOne: item.lotSizeForCostingIsOne,
      }
      if (item.quantity === 0 || item.grossPrice === 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Quantity and GrossPrice are required',
          life: 3000
        });
      }
      console.log(newRecord);
      // Remove properties with empty or default values
      const filteredRecord = Object.fromEntries(
        Object.entries(newRecord).filter(([_, value]) => {
          return value !== '' && value !== 0 && value !== undefined && value !== null;
        })
      );
      console.log(filteredRecord);
      this.apiService.post<ModelSpecDetails>('modelspecdetails', filteredRecord).subscribe((response: ModelSpecDetails) => {
        console.log('modelspecdetails created:', response);
        if (response) {
          this.resetNewService();
          this.selectedFormulaRecordForExcel = undefined
          this.selectedServiceNumberRecordForExcel = undefined
          console.log(this.newService);

          const newDetail = response;
          if (this.modelSpecRecord) {
            this.modelSpecRecord.modelSpecDetailsCode.push(newDetail.modelSpecDetailsCode);
            this.apiService.put<ModelEntity>('modelspecs', this.modelSpecRecord.modelSpecCode, this.modelSpecRecord).subscribe(updatedModel => {
              console.log('Model updated:', updatedModel);
            });
          }
        }
        console.log(response);
        this.totalValue = 0;
        const index = this.parsedData.findIndex(item => item.modelSpecDetailsCode === item.modelSpecDetailsCode);
        if (index !== -1) {
          this.parsedData.splice(index, 1);
        }
        //this.modelSpecDetailsService.getRecords();
        this.ngOnInit()
      });
    }
    else if (!this.selectedServiceNumberRecordForExcel && this.selectedFormulaRecordForExcel && this.resultAfterTest) { // if user didn't select serviceNumber && select formula
      const newRecord = {
        serviceNumberCode: item.serviceNumberCode,
        lineTypeCode: item.lineTypeCode,
        unitOfMeasurementCode: item.unitOfMeasurementCode,
        currencyCode: this.modelSpecRecord?.currencyCode,
        personnelNumberCode: item.personnelNumberCode,
        serviceTypeCode: item.serviceTypeCode,
        materialGroupCode: item.materialGroupCode,
        formulaCode: item.formulaCode,
        shortText: item.shortText,
        quantity: this.resultAfterTest,
        grossPrice: item.grossPrice,
        overFulfilmentPercentage: item.overFulfilmentPercentage,
        priceChangedAllowed: item.priceChangedAllowed,
        unlimitedOverFulfillment: item.unlimitedOverFulfillment,
        pricePerUnitOfMeasurement: item.pricePerUnitOfMeasurement,
        externalServiceNumber: item.externalServiceNumber,
        netValue: this.resultAfterTest * item.grossPrice,
        serviceText: item.serviceText,
        lineText: item.lineText,
        lineNumber: item.lineNumber,
        alternatives: item.alternatives,
        biddersLine: item.biddersLine,
        supplementaryLine: item.supplementaryLine,
        lotSizeForCostingIsOne: item.lotSizeForCostingIsOne,
      }
      if (this.resultAfterTest === 0 || item.grossPrice === 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Quantity and GrossPrice are required',
          life: 3000
        });
      }
      console.log(newRecord);
      // Remove properties with empty or default values
      const filteredRecord = Object.fromEntries(
        Object.entries(newRecord).filter(([_, value]) => {
          return value !== '' && value !== 0 && value !== undefined && value !== null;
        })
      );
      console.log(filteredRecord);
      this.apiService.post<ModelSpecDetails>('modelspecdetails', filteredRecord).subscribe((response: ModelSpecDetails) => {
        console.log('modelspecdetails created:', response);
        if (response) {
          this.resetNewService();
          this.selectedFormulaRecordForExcel = undefined
          console.log(this.newService);

          const newDetail = response;
          if (this.modelSpecRecord) {
            this.modelSpecRecord.modelSpecDetailsCode.push(newDetail.modelSpecDetailsCode);
            this.apiService.put<ModelEntity>('modelspecs', this.modelSpecRecord.modelSpecCode, this.modelSpecRecord).subscribe(updatedModel => {
              console.log('Model updated:', updatedModel);
            });
          }
        }
        console.log(response);
        this.totalValue = 0;
        const index = this.parsedData.findIndex(item => item.modelSpecDetailsCode === item.modelSpecDetailsCode);
        if (index !== -1) {
          this.parsedData.splice(index, 1);
        }
        //this.modelSpecDetailsService.getRecords();
        this.ngOnInit()
      });
    }
    else if (!this.selectedServiceNumberRecordForExcel && !this.selectedFormulaRecordForExcel) { // if user didn't select serviceNumber && didn't select formula
      const newRecord = {
        serviceNumberCode: item.serviceNumberCode,
        lineTypeCode: item.lineTypeCode,
        unitOfMeasurementCode: item.unitOfMeasurementCode,
        currencyCode: this.modelSpecRecord?.currencyCode,
        personnelNumberCode: item.personnelNumberCode,
        serviceTypeCode: item.serviceTypeCode,
        materialGroupCode: item.materialGroupCode,
        formulaCode: item.formulaCode,
        shortText: item.shortText,
        quantity: item.quantity,
        grossPrice: item.grossPrice,
        overFulfilmentPercentage: item.overFulfilmentPercentage,
        priceChangedAllowed: item.priceChangedAllowed,
        unlimitedOverFulfillment: item.unlimitedOverFulfillment,
        pricePerUnitOfMeasurement: item.pricePerUnitOfMeasurement,
        externalServiceNumber: item.externalServiceNumber,
        netValue: item.quantity * item.grossPrice,
        serviceText: item.serviceText,
        lineText: item.lineText,
        lineNumber: item.lineNumber,
        alternatives: item.alternatives,
        biddersLine: item.biddersLine,
        supplementaryLine: item.supplementaryLine,
        lotSizeForCostingIsOne: item.lotSizeForCostingIsOne,
      }
      if (item.quantity === 0 || item.grossPrice === 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Quantity and GrossPrice are required',
          life: 3000
        });
      }
      console.log(newRecord);
      // Remove properties with empty or default values
      const filteredRecord = Object.fromEntries(
        Object.entries(newRecord).filter(([_, value]) => {
          return value !== '' && value !== 0 && value !== undefined && value !== null;
        })
      );
      console.log(filteredRecord);
      this.apiService.post<ModelSpecDetails>('modelspecdetails', filteredRecord).subscribe((response: ModelSpecDetails) => {
        console.log('modelspecdetails created:', response);
        if (response) {
          this.resetNewService();
          console.log(this.newService);

          const newDetail = response;
          if (this.modelSpecRecord) {
            this.modelSpecRecord.modelSpecDetailsCode.push(newDetail.modelSpecDetailsCode);
            this.apiService.put<ModelEntity>('modelspecs', this.modelSpecRecord.modelSpecCode, this.modelSpecRecord).subscribe(updatedModel => {
              console.log('Model updated:', updatedModel);
            });
          }
        }
        console.log(response);
        this.totalValue = 0;
        const index = this.parsedData.findIndex(item => item.modelSpecDetailsCode === item.modelSpecDetailsCode);
        if (index !== -1) {
          this.parsedData.splice(index, 1);
        }
        // this.modelSpecDetailsService.getRecords();
        this.ngOnInit()
      });
    }
  }
  cancelFromExcel(item: any): void {
    this.parsedData = this.parsedData.filter(i => i !== item);
  }
  // end import from excel sheet

  public isMatch(record: any, ri: number): boolean {
    if (!this.searchTerm) {
      return true; // Display all records when search term is empty
    }
    const searchString = this.rowIndex + ri + 1;
    return searchString === this.searchTerm;
  }
  //Display Line Details:
  selectedDetailsForDisplay?: ModelSpecDetails
  visible: boolean = false;
  showDialog() {
    this.visible = true;
  }

  // handle Deletion Record/ Records
  deleteRecord() {
    if (this.selectedRecords.length) {
      this.confirmationService.confirm({
        message: 'Are you sure you want to delete the selected record?',
        header: 'Confirm',
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
          for (const record of this.selectedRecords) {
            console.log(this.modelSpecRecord);
            const updatedRecord: ModelSpecDetails = {
              ...record, // Copy all properties from the original record
              deletionIndicator: true
            }
            console.log(updatedRecord);

            if (this.modelSpecRecord) {
              const indexToRemove = this.modelSpecRecord.modelSpecDetailsCode.indexOf(updatedRecord.modelSpecDetailsCode);
              console.log(indexToRemove);

              if (indexToRemove !== -1) {
                this.modelSpecRecord.modelSpecDetailsCode.splice(indexToRemove, 1);
              }
              console.log(this.modelSpecRecord);
              this.apiService.put<ModelEntity>('modelspecs', this.modelSpecRecord.modelSpecCode, this.modelSpecRecord).subscribe({
                next: (res) => {
                  console.log('Model updated and delete from it modelspec details:', res);
                  this.totalValue = 0;
                  this.ngOnInit();
                }
                , error: (err) => {
                  console.log(err);
                },
                complete: () => {
                }

              });
            }
            // this.apiService.put<ModelSpecDetails>('modelspecdetails', record.modelSpecDetailsCode, updatedRecord).subscribe(response => {
            //   console.log('model spec marked deleted and updated in DB:', response);
            //   this.totalValue = 0;
            //   this.ngOnInit();
            // });

          }
          this.messageService.add({ severity: 'success', summary: 'Successfully', detail: 'Deleted', life: 3000 });
          this.selectedRecords = []; // Clear the selectedRecords array after deleting all records
        }
      });
    }
    if (this.selectedAllRecords.length > 0) {
      this.confirmationService.confirm({
        message: 'Are you sure you want to delete the selected record?',
        header: 'Confirm',
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
          for (const record of this.selectedAllRecords) {
            const updatedRecord: ModelSpecDetails = {
              ...record, // Copy all properties from the original record
              deletionIndicator: true
            }
            console.log(updatedRecord);

            if (this.modelSpecRecord) {
              const indexToRemove = this.modelSpecRecord.modelSpecDetailsCode.indexOf(updatedRecord.modelSpecDetailsCode);
              console.log(indexToRemove);

              if (indexToRemove !== -1) {
                this.modelSpecRecord.modelSpecDetailsCode.splice(indexToRemove, 1);
              }
              console.log(this.modelSpecRecord);
              this.apiService.put<ModelEntity>('modelspecs', this.modelSpecRecord.modelSpecCode, this.modelSpecRecord).subscribe({
                next: (res) => {
                  console.log('Model updated and delete from it modelspec details:', res);
                  this.totalValue = 0;
                  this.ngOnInit();
                }
                , error: (err) => {
                  console.log(err);
                },
                complete: () => {
                }

              });
            }

            // this.apiService.put<ModelSpecDetails>('modelspecdetails', record.modelSpecDetailsCode, updatedRecord).subscribe(response => {
            //   console.log('model spec marked deleted and updated in DB:', response);
            //   this.totalValue = 0;
            //   this.ngOnInit()
            // });
          }
          this.messageService.add({ severity: 'success', summary: 'Successfully', detail: 'Deleted', life: 3000 });
          this.selectedAllRecords = [];
        }
      });
    }
  }
  // For Edit 
  clonedModelSpecDetails: { [s: number]: ModelSpecDetails } = {};
  onRowEditInit(record: ModelSpecDetails) {
    this.clonedModelSpecDetails[record.modelSpecDetailsCode] = { ...record };
  }
  onRowEditSave(index: number, record: ModelSpecDetails) {
    console.log(this.updateSelectedServiceNumber);
    if (this.updateSelectedServiceNumberRecord) {
      const newRecord: ModelSpecDetails = {
        ...record, // Copy all properties from the original record
        // Modify specific attributes
        unitOfMeasurementCode: this.updateSelectedServiceNumberRecord.baseUnitOfMeasurement,
        materialGroupCode: this.updateSelectedServiceNumberRecord.materialGroupCode,
        serviceTypeCode: this.updateSelectedServiceNumberRecord.serviceTypeCode,
        shortText: this.updateSelectedServiceNumberRecord.description,
        serviceText: this.updateSelectedServiceNumberRecord.serviceText,
      };
      console.log(newRecord);
      this.apiService.put<ModelSpecDetails>('modelspecdetails', index, newRecord).subscribe(response => {
        console.log('modelspecDetail updated:', response);
        if (response) {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Record is updated' });
        }
        else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid Data' });
        }
        console.log(this.totalValue)
        this.totalValue = 0;
        this.ngOnInit()
      });
    }
    if (this.updateSelectedServiceNumberRecord && this.updatedFormulaRecord && this.resultAfterTestUpdate) {
      console.log(record);
      console.log(this.updateSelectedServiceNumberRecord);
      const newRecord: ModelSpecDetails = {
        ...record,
        unitOfMeasurementCode: this.updateSelectedServiceNumberRecord.baseUnitOfMeasurement,
        materialGroupCode: this.updateSelectedServiceNumberRecord.materialGroupCode,
        serviceTypeCode: this.updateSelectedServiceNumberRecord.serviceTypeCode,
        shortText: this.updateSelectedServiceNumberRecord.description,
        serviceText: this.updateSelectedServiceNumberRecord.serviceText,
        quantity: this.resultAfterTestUpdate,
      };
      console.log(newRecord);
      this.apiService.put<ModelSpecDetails>('modelspecdetails', index, newRecord).subscribe(response => {
        console.log('modelspecDetail updated:', response);
        if (response) {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Record is updated' });
        }
        else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid Data' });
        }
        console.log(this.totalValue)
        this.totalValue = 0;
        this.ngOnInit()
        console.log(this.totalValue)
      });
    }
    if (this.updatedFormulaRecord && this.resultAfterTestUpdate) {
      const newRecord: ModelSpecDetails = {
        ...record,
        quantity: this.resultAfterTestUpdate,
      };
      console.log(newRecord);
      this.apiService.put<ModelSpecDetails>('modelspecdetails', index, newRecord).subscribe(response => {
        console.log('modelspecDetail updated:', response);
        if (response) {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Record is updated' });
        }
        else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid Data' });
        }
        console.log(this.totalValue)
        this.totalValue = 0;
        this.ngOnInit()
        console.log(this.totalValue)
      });
    }
    if (!this.updateSelectedServiceNumberRecord && !this.updatedFormulaRecord && !this.resultAfterTestUpdate) {
      this.apiService.put<ModelSpecDetails>('modelspecdetails', index, record).subscribe(response => {
        console.log('modelspecDetail updated:', response);
        if (response) {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Record is updated' });
        }
        else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid Data' });
        }
        this.totalValue = 0;
        //this.modelSpecDetailsService.getRecords();
        this.ngOnInit()
      });
    }
  }
  onRowEditCancel(row: ModelSpecDetails, index: number) {
    this.records[index] = this.clonedModelSpecDetails[row.modelSpecDetailsCode]
    delete this.clonedModelSpecDetails[row.modelSpecDetailsCode]
  }
  // For Add new Record
  newService: ModelSpecDetails = {
    serviceNumberCode: 0,
    lineTypeCode: '',
    unitOfMeasurementCode: '',
    currencyCode: '',
    personnelNumberCode: '',
    serviceTypeCode: '',
    materialGroupCode: '',
    formulaCode: '',
    selectionCheckbox: false,
    lineIndex: 0,
    deletionIndicator: false,
    shortText: '',
    quantity: 0,
    grossPrice: 0,
    overFulfilmentPercentage: 0,
    priceChangedAllowed: false,
    unlimitedOverFulfillment: false,
    pricePerUnitOfMeasurement: 0,
    externalServiceNumber: '',
    netValue: 0,
    serviceText: '',
    lineText: '',
    lineNumber: '',
    alternatives: '',
    biddersLine: false,
    supplementaryLine: false,
    lotSizeForCostingIsOne: false,
    modelSpecDetailsCode: 0
  };
  addRow() {
    if (!this.selectedServiceNumberRecord && !this.selectedFormulaRecord) { // if user didn't select serviceNumber && didn't select formula
      const newRecord = {
        //serviceNumberCode: this.selectedServiceNumber,
        lineTypeCode: this.selectedLineType,
        unitOfMeasurementCode: this.selectedUnitOfMeasure,
        currencyCode: this.modelSpecRecord?.currencyCode,
        personnelNumberCode: this.selectedPersonnelNumber,
        serviceTypeCode: this.selectedServiceType,
        materialGroupCode: this.selectedMatGrp,
        formulaCode: this.selectedFormula,
        deletionIndicator: this.newService.deletionIndicator,
        shortText: this.newService.shortText,
        quantity: this.newService.quantity,
        grossPrice: this.newService.grossPrice,
        overFulfilmentPercentage: this.newService.overFulfilmentPercentage,
        priceChangedAllowed: this.newService.priceChangedAllowed,
        unlimitedOverFulfillment: this.newService.unlimitedOverFulfillment,
        pricePerUnitOfMeasurement: this.newService.pricePerUnitOfMeasurement,
        externalServiceNumber: this.newService.externalServiceNumber,
        netValue: this.newService.netValue,
        serviceText: this.newService.serviceText,
        lineText: this.newService.lineText,
        lineNumber: this.newService.lineNumber,
        alternatives: this.newService.alternatives,
        biddersLine: this.newService.biddersLine,
        supplementaryLine: this.newService.supplementaryLine,
        lotSizeForCostingIsOne: this.newService.lotSizeForCostingIsOne,
      }
      if (this.newService.quantity === 0 || this.newService.grossPrice === 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Quantity and GrossPrice are required',
          life: 3000
        });
      }
      console.log(newRecord);
      // Remove properties with empty or default values
      const filteredRecord = Object.fromEntries(
        Object.entries(newRecord).filter(([_, value]) => {
          return value !== '' && value !== 0 && value !== undefined && value !== null;
        })
      );
      console.log(filteredRecord);
      this.apiService.post<ModelSpecDetails>('modelspecdetails', filteredRecord).subscribe((response: ModelSpecDetails) => {
        console.log('modelspecdetails created:', response);
        if (response) {
          this.resetNewService();
          console.log(this.newService);

          const newDetail = response;
          if (this.modelSpecRecord) {
            this.modelSpecRecord.modelSpecDetailsCode.push(newDetail.modelSpecDetailsCode);
            this.apiService.put<ModelEntity>('modelspecs', this.modelSpecRecord.modelSpecCode, this.modelSpecRecord).subscribe(updatedModel => {
              console.log('Model updated:', updatedModel);
            });
          }
        }
        console.log(response);
        this.totalValue = 0;
        // this.modelSpecDetailsService.getRecords();
        this.ngOnInit()
      });
    }
    else if (!this.selectedServiceNumberRecord && this.selectedFormulaRecord && this.resultAfterTest) { // if user didn't select serviceNumber && select formula
      const newRecord = {
        //serviceNumberCode: this.selectedServiceNumber,
        lineTypeCode: this.selectedLineType,
        unitOfMeasurementCode: this.selectedUnitOfMeasure,
        currencyCode: this.modelSpecRecord?.currencyCode,
        personnelNumberCode: this.selectedPersonnelNumber,
        serviceTypeCode: this.selectedServiceType,
        materialGroupCode: this.selectedMatGrp,
        formulaCode: this.selectedFormula,
        deletionIndicator: this.newService.deletionIndicator,
        shortText: this.newService.shortText,
        // quantity: this.selectedFormulaRecord.result,
        quantity: this.resultAfterTest,
        grossPrice: this.newService.grossPrice,
        overFulfilmentPercentage: this.newService.overFulfilmentPercentage,
        priceChangedAllowed: this.newService.priceChangedAllowed,
        unlimitedOverFulfillment: this.newService.unlimitedOverFulfillment,
        pricePerUnitOfMeasurement: this.newService.pricePerUnitOfMeasurement,
        externalServiceNumber: this.newService.externalServiceNumber,
        netValue: this.newService.netValue,
        serviceText: this.newService.serviceText,
        lineText: this.newService.lineText,
        lineNumber: this.newService.lineNumber,
        alternatives: this.newService.alternatives,
        biddersLine: this.newService.biddersLine,
        supplementaryLine: this.newService.supplementaryLine,
        lotSizeForCostingIsOne: this.newService.lotSizeForCostingIsOne,
      }
      if (this.resultAfterTest === 0 || this.newService.grossPrice === 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Quantity and GrossPrice are required',
          life: 3000
        });
      }
      console.log(newRecord);
      // Remove properties with empty or default values
      const filteredRecord = Object.fromEntries(
        Object.entries(newRecord).filter(([_, value]) => {
          return value !== '' && value !== 0 && value !== undefined && value !== null;
        })
      );
      console.log(filteredRecord);
      this.apiService.post<ModelSpecDetails>('modelspecdetails', filteredRecord).subscribe((response: ModelSpecDetails) => {
        console.log('modelspecdetails created:', response);
        if (response) {
          this.resetNewService();
          this.selectedFormulaRecord = undefined
          console.log(this.newService);

          const newDetail = response;
          if (this.modelSpecRecord) {
            this.modelSpecRecord.modelSpecDetailsCode.push(newDetail.modelSpecDetailsCode);
            this.apiService.put<ModelEntity>('modelspecs', this.modelSpecRecord.modelSpecCode, this.modelSpecRecord).subscribe(updatedModel => {
              console.log('Model updated:', updatedModel);
            });
          }
        }
        console.log(response);
        this.totalValue = 0;
        //this.modelSpecDetailsService.getRecords();
        this.ngOnInit()
      });
    }
    else if (this.selectedServiceNumberRecord && !this.selectedFormulaRecord && !this.resultAfterTest) { // if user select serviceNumber && didn't select formula
      const newRecord = {
        serviceNumberCode: this.selectedServiceNumber,
        lineTypeCode: this.selectedLineType,
        unitOfMeasurementCode: this.selectedServiceNumberRecord.baseUnitOfMeasurement,
        currencyCode: this.modelSpecRecord?.currencyCode,
        personnelNumberCode: this.selectedPersonnelNumber,
        serviceTypeCode: this.selectedServiceNumberRecord.serviceTypeCode,
        materialGroupCode: this.selectedServiceNumberRecord.materialGroupCode,
        formulaCode: this.selectedFormula,
        deletionIndicator: this.newService.deletionIndicator,
        shortText: this.selectedServiceNumberRecord.description,
        // quantity: this.selectedFormulaRecord.result,
        quantity: this.newService.quantity,
        grossPrice: this.newService.grossPrice,
        overFulfilmentPercentage: this.newService.overFulfilmentPercentage,
        priceChangedAllowed: this.newService.priceChangedAllowed,
        unlimitedOverFulfillment: this.newService.unlimitedOverFulfillment,
        pricePerUnitOfMeasurement: this.newService.pricePerUnitOfMeasurement,
        externalServiceNumber: this.newService.externalServiceNumber,
        netValue: this.newService.netValue,
        // netValue: this.resultAfterTest * this.newService.grossPrice,
        serviceText: this.selectedServiceNumberRecord.serviceText,
        lineText: this.newService.lineText,
        lineNumber: this.newService.lineNumber,
        alternatives: this.newService.alternatives,
        biddersLine: this.newService.biddersLine,
        supplementaryLine: this.newService.supplementaryLine,
        lotSizeForCostingIsOne: this.newService.lotSizeForCostingIsOne,
      }
      if (this.newService.quantity === 0 || this.newService.grossPrice === 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Quantity and GrossPrice are required',
          life: 3000
        });
      }
      console.log(newRecord);
      // Remove properties with empty or default values
      const filteredRecord = Object.fromEntries(
        Object.entries(newRecord).filter(([_, value]) => {
          return value !== '' && value !== 0 && value !== undefined && value !== null;
        })
      );
      console.log(filteredRecord);
      this.apiService.post<ModelSpecDetails>('modelspecdetails', filteredRecord).subscribe((response: ModelSpecDetails) => {
        console.log('modelspecdetails created:', response);
        if (response) {
          this.resetNewService();
          this.selectedFormulaRecord = undefined
          this.selectedServiceNumberRecord = undefined
          console.log(this.newService);

          const newDetail = response;
          if (this.modelSpecRecord) {
            this.modelSpecRecord.modelSpecDetailsCode.push(newDetail.modelSpecDetailsCode);
            this.apiService.put<ModelEntity>('modelspecs', this.modelSpecRecord.modelSpecCode, this.modelSpecRecord).subscribe(updatedModel => {
              console.log('Model updated:', updatedModel);
            });
          }
        }
        console.log(response);
        this.totalValue = 0;
        //this.modelSpecDetailsService.getRecords();
        this.ngOnInit()
      });
    }
    else if (this.selectedServiceNumberRecord && this.selectedFormulaRecord && this.resultAfterTest) { // if user select serviceNumber && select formula
      const newRecord = {
        serviceNumberCode: this.selectedServiceNumber,
        lineTypeCode: this.selectedLineType,
        unitOfMeasurementCode: this.selectedServiceNumberRecord.baseUnitOfMeasurement,
        currencyCode: this.modelSpecRecord?.currencyCode,
        personnelNumberCode: this.selectedPersonnelNumber,
        serviceTypeCode: this.selectedServiceNumberRecord.serviceTypeCode,
        materialGroupCode: this.selectedServiceNumberRecord.materialGroupCode,
        formulaCode: this.selectedFormula,
        deletionIndicator: this.newService.deletionIndicator,
        shortText: this.selectedServiceNumberRecord.description,
        // quantity: this.selectedFormulaRecord.result,
        quantity: this.resultAfterTest,
        grossPrice: this.newService.grossPrice,
        overFulfilmentPercentage: this.newService.overFulfilmentPercentage,
        priceChangedAllowed: this.newService.priceChangedAllowed,
        unlimitedOverFulfillment: this.newService.unlimitedOverFulfillment,
        pricePerUnitOfMeasurement: this.newService.pricePerUnitOfMeasurement,
        externalServiceNumber: this.newService.externalServiceNumber,
        netValue: this.newService.netValue,
        // netValue: this.resultAfterTest * this.newService.grossPrice,
        serviceText: this.selectedServiceNumberRecord.serviceText,
        lineText: this.newService.lineText,
        lineNumber: this.newService.lineNumber,
        alternatives: this.newService.alternatives,
        biddersLine: this.newService.biddersLine,
        supplementaryLine: this.newService.supplementaryLine,
        lotSizeForCostingIsOne: this.newService.lotSizeForCostingIsOne,
      }
      if (this.resultAfterTest === 0 || this.newService.grossPrice === 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Quantity and GrossPrice are required',
          life: 3000
        });
      }
      console.log(newRecord);
      // Remove properties with empty or default values
      const filteredRecord = Object.fromEntries(
        Object.entries(newRecord).filter(([_, value]) => {
          return value !== '' && value !== 0 && value !== undefined && value !== null;
        })
      );
      console.log(filteredRecord);
      this.apiService.post<ModelSpecDetails>('modelspecdetails', filteredRecord).subscribe((response: ModelSpecDetails) => {
        console.log('modelspecdetails created:', response);
        if (response) {
          this.resetNewService();
          this.selectedFormulaRecord = undefined
          this.selectedServiceNumberRecord = undefined
          console.log(this.newService);

          const newDetail = response;
          if (this.modelSpecRecord) {
            this.modelSpecRecord.modelSpecDetailsCode.push(newDetail.modelSpecDetailsCode);
            this.apiService.put<ModelEntity>('modelspecs', this.modelSpecRecord.modelSpecCode, this.modelSpecRecord).subscribe(updatedModel => {
              console.log('Model updated:', updatedModel);
            });
          }
        }
        console.log(response);
        this.totalValue = 0;
        //this.modelSpecDetailsService.getRecords();
        this.ngOnInit()
      });
    }
  }

  // handle Formula Parameters 
  showPopup: boolean = false;
  parameterValues: { [key: string]: number } = {};
  showPopupUpdate: boolean = false;
  parameterValuesUpdate: { [key: string]: number } = {};
  openPopup() {
    if (this.selectedFormulaRecord) {
      this.showPopup = true;
      for (const parameterId of this.selectedFormulaRecord.parameterIds) {
        this.parameterValues[parameterId] = 0;
        console.log(this.parameterValues);
      }
    }
    if (this.selectedFormulaRecordForExcel) {
      this.showPopup = true;
      for (const parameterId of this.selectedFormulaRecordForExcel.parameterIds) {
        this.parameterValues[parameterId] = 0;
        console.log(this.parameterValues);
      }
    }
    else {
      this.showPopup = false;
    }
  }
  openPopupUpdate() {
    if (this.updatedFormulaRecord) {
      this.showPopupUpdate = true;
      console.log(this.showPopupUpdate);

      for (const parameterId of this.updatedFormulaRecord.parameterIds) {
        this.parameterValuesUpdate[parameterId] = 0;
        console.log(this.parameterValuesUpdate);
      }
    }
    else {
      this.showPopupUpdate = false;
    }
  }
  resultAfterTest!: number
  resultAfterTestUpdate!: number
  saveParameters() {
    if (this.selectedFormulaRecord) {
      console.log(this.parameterValues);
      const valuesOnly = Object.values(this.parameterValues)
        .filter(value => typeof value === 'number') as number[];
      console.log(valuesOnly);
      console.log(this.resultAfterTest);

      const formulaObject: any = {
        formula: this.selectedFormulaRecord.formula,
        description: this.selectedFormulaRecord.description,
        numberOfParameters: this.selectedFormulaRecord.numberOfParameters,
        parameterIds: this.selectedFormulaRecord.parameterIds,
        parameterDescriptions: this.selectedFormulaRecord.parameterDescriptions,
        formulaLogic: this.selectedFormulaRecord.formulaLogic,
        testParameters: valuesOnly
      };
      console.log(formulaObject);
      this.apiService.put<any>('formulas', this.selectedFormulaRecord.formulaCode, formulaObject).subscribe((response: Formula) => {
        console.log('formula updated:', response);
        this.resultAfterTest = response.result;
        console.log(this.resultAfterTest);
      });
      this.showPopup = false;
    }
    if (this.selectedFormulaRecordForExcel) {
      console.log(this.parameterValues);
      const valuesOnly = Object.values(this.parameterValues)
        .filter(value => typeof value === 'number') as number[];
      console.log(valuesOnly);
      console.log(this.resultAfterTest);

      const formulaObject: any = {
        formula: this.selectedFormulaRecordForExcel.formula,
        description: this.selectedFormulaRecordForExcel.description,
        numberOfParameters: this.selectedFormulaRecordForExcel.numberOfParameters,
        parameterIds: this.selectedFormulaRecordForExcel.parameterIds,
        parameterDescriptions: this.selectedFormulaRecordForExcel.parameterDescriptions,
        formulaLogic: this.selectedFormulaRecordForExcel.formulaLogic,
        testParameters: valuesOnly
      };
      console.log(formulaObject);
      this.apiService.put<any>('formulas', this.selectedFormulaRecordForExcel.formulaCode, formulaObject).subscribe((response: Formula) => {
        console.log('formula updated:', response);
        this.resultAfterTest = response.result;
        console.log(this.resultAfterTest);
      });
      this.showPopup = false;
    }
    if (this.updatedFormulaRecord) {
      console.log(this.parameterValuesUpdate);
      const valuesOnly = Object.values(this.parameterValuesUpdate)
        .filter(value => typeof value === 'number') as number[];
      console.log(valuesOnly);
      console.log(this.resultAfterTestUpdate);
      const formulaObject: any = {
        formula: this.updatedFormulaRecord.formula,
        description: this.updatedFormulaRecord.description,
        numberOfParameters: this.updatedFormulaRecord.numberOfParameters,
        parameterIds: this.updatedFormulaRecord.parameterIds,
        parameterDescriptions: this.updatedFormulaRecord.parameterDescriptions,
        formulaLogic: this.updatedFormulaRecord.formulaLogic,
        testParameters: valuesOnly
      };
      console.log(formulaObject);
      this.apiService.put<any>('formulas', this.updatedFormulaRecord.formulaCode, formulaObject).subscribe((response: Formula) => {
        console.log('formula updated:', response);
        this.resultAfterTestUpdate = response.result;
        console.log(this.resultAfterTestUpdate);

      });
      this.showPopupUpdate = false;
    }
  }

  closePopup() {
    this.showPopupUpdate = false;
    this.showPopup = false;
  }

  // Export to excel sheet:
  transformData(data: ModelSpecDetails[]) {
    const transformed: ModelSpecDetails[] = [];

    data.forEach((mainItem) => {
      transformed.push({
        serviceNumberCode: mainItem.serviceNumberCode,
        shortText: mainItem.shortText,
        quantity: mainItem.quantity,
        unitOfMeasurementCode: mainItem.unitOfMeasurementCode,
        formulaCode: mainItem.formulaCode,
        grossPrice: mainItem.grossPrice,
        currencyCode: mainItem.currencyCode,
        netValue: mainItem.netValue,
        modelSpecDetailsCode: mainItem.modelSpecDetailsCode,
        lineTypeCode: mainItem.lineTypeCode,
        personnelNumberCode: mainItem.personnelNumberCode,
        serviceTypeCode: mainItem.serviceTypeCode,
        materialGroupCode: mainItem.materialGroupCode,
        selectionCheckbox: false,
        lineIndex: 0,
        deletionIndicator: false,
        overFulfilmentPercentage: mainItem.overFulfilmentPercentage,
        priceChangedAllowed: mainItem.priceChangedAllowed,
        unlimitedOverFulfillment: mainItem.unlimitedOverFulfillment,
        pricePerUnitOfMeasurement: mainItem.pricePerUnitOfMeasurement,
        externalServiceNumber: mainItem.externalServiceNumber,
        serviceText: mainItem.serviceText,
        lineText: mainItem.lineText,
        lineNumber: mainItem.lineNumber,
        alternatives: mainItem.alternatives,
        biddersLine: mainItem.biddersLine,
        supplementaryLine: mainItem.supplementaryLine,
        lotSizeForCostingIsOne: mainItem.lotSizeForCostingIsOne
      });

    });
    return transformed;
  }
  exportExcel() {
    import('xlsx').then((xlsx) => {
      const transformedData = this.transformData(this.records);
      const worksheet = xlsx.utils.json_to_sheet(transformedData);
      const workbook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
      const ws = workbook.Sheets.data;
      if (!ws['!ref']) {
        ws['!ref'] = 'A1:Z1000';
      }
      const range = xlsx.utils.decode_range(ws['!ref']);
      let rowStart = 1;
      // transformedData.forEach((row, index) => {
      //   if (row.Type === 'Main Item') {
      //     if (
      //       index + 1 < transformedData.length &&
      //       transformedData[index + 1].Type === 'Sub Item'
      //     ) {
      //       ws['!rows'] = ws['!rows'] || [];
      //       ws['!rows'][index] = { hidden: false };
      //       ws['!rows'][index + 1] = { hidden: false };
      //     } else {
      //       ws['!rows'] = ws['!rows'] || [];
      //       ws['!rows'][index] = { hidden: false };
      //     }
      //   } else {
      //     ws['!rows'] = ws['!rows'] || [];
      //     ws['!rows'][index] = { hidden: false };
      //   }
      // });
      const excelBuffer: any = xlsx.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      });
      this.saveAsExcelFile(excelBuffer, ' Model Specs Details');
    });
  }
  // mainItemsRecords(mainItemsRecords: any) {
  //   throw new Error('Method not implemented.');
  // }
  saveAsExcelFile(buffer: any, fileName: string): void {
    let EXCEL_TYPE =
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
    let EXCEL_EXTENSION = '.xlsx';
    const data: Blob = new Blob([buffer], {
      type: EXCEL_TYPE,
    });
    FileSaver.saveAs(
      data,
      fileName + '_export_' + new Date().getTime() + EXCEL_EXTENSION
    );
  }


  /* Helper Functions */

   // to handle selection checkbox
   selectedRecords: ModelSpecDetails[] = [];
   onRecordSelectionChange(event: any, record: ModelSpecDetails) {
     this.selectedDetailsForDisplay = record
     this.selectedRecords = event.checked
   }
   // to handle All Records Selection / Deselection 
   selectedAllRecords: ModelSpecDetails[] = [];
   onSelectAllRecords(event: any): void {
     if (Array.isArray(event.checked) && event.checked.length > 0) {
       this.selectedAllRecords = [...this.records];
     } else {
       this.selectedAllRecords = [];
     }
   }
 
   selectedFormulaRecord: any
   selectedFormulaRecordForExcel: any
   updatedFormula!: number;
   updatedFormulaRecord: any
 
   onFormulaSelect(event: any) {
     const selectedRecord = this.recordsFormula.find(record => record.formula === this.selectedFormula);
     if (selectedRecord) {
       this.selectedFormulaRecord = selectedRecord
     }
     else {
       console.log("no Formula");
       this.selectedFormulaRecord = undefined;
     }
   }
   onFormulaSelectForExcel(event: any, index: number) {
     const currentItem = this.parsedData[index];
     const selectedRecord = this.recordsFormula.find(record => record.formula === currentItem.formulaCode);
     if (selectedRecord) {
       this.selectedFormulaRecordForExcel = selectedRecord
     }
     else {
       console.log("no Formula");
       this.selectedFormulaRecordForExcel = undefined;
     }
   }
 
   onFormulaUpdateSelect(event: any) {
     const selectedRecord = this.recordsFormula.find(record => record.formula === event.value);
     if (selectedRecord) {
       this.updatedFormulaRecord = selectedRecord
     }
     else {
       this.updatedFormulaRecord = undefined;
       console.log(this.updatedFormulaRecord);
     }
   }
   onServiceNumberChangeForExcelSheet(event: any, index: number): void {
     const currentItem = this.parsedData[index];
     const selectedRecord = this.recordsServiceNumber.find(record => record.serviceNumberCode === currentItem.serviceNumberCode);
     if (selectedRecord) {
       this.selectedServiceNumberRecordForExcel = selectedRecord
       // this.shortTextChangeAllowed = this.selectedServiceNumberRecord?.shortTextChangeAllowed || false;
       // this.shortText = ""
     }
     else {
       console.log("no service number");
       this.dontSelectServiceNumber = false
       this.selectedServiceNumberRecordForExcel = undefined;
     }
   }
 
   //In Creation to handle shortTextChangeAlowlled Flag 
   onServiceNumberChange(event: any) {
     console.log(event);
     const selectedRecord = this.recordsServiceNumber.find(record => record.serviceNumberCode === this.selectedServiceNumber);
     if (selectedRecord) {
       this.selectedServiceNumberRecord = selectedRecord
       this.shortTextChangeAllowed = this.selectedServiceNumberRecord?.shortTextChangeAllowed || false;
       this.shortText = ""
     }
     else {
       console.log("no service number");
       this.dontSelectServiceNumber = false
       this.selectedServiceNumberRecord = undefined;
     }
   }
   //In Update to handle shortTextChangeAlowlled Flag 
   onServiceNumberUpdateChange(event: any) {
     const updateSelectedRecord = this.recordsServiceNumber.find(record => record.serviceNumberCode === event.value);
     if (updateSelectedRecord) {
       this.updateSelectedServiceNumberRecord = updateSelectedRecord
       this.updateShortTextChangeAllowed = this.updateSelectedServiceNumberRecord?.shortTextChangeAllowed || false;
       this.updateShortText = ""
     }
     else {
       this.updateSelectedServiceNumberRecord = undefined;
     }
   }
   
  resetNewService() {
    this.newService = {
      serviceNumberCode: 0,
      lineTypeCode: '',
      unitOfMeasurementCode: '',
      currencyCode: '',
      personnelNumberCode: '',
      serviceTypeCode: '',
      materialGroupCode: '',
      formulaCode: '',
      selectionCheckbox: false,
      lineIndex: 0,
      deletionIndicator: false,
      shortText: '',
      quantity: 0,
      grossPrice: 0,
      overFulfilmentPercentage: 0,
      priceChangedAllowed: false,
      unlimitedOverFulfillment: false,
      pricePerUnitOfMeasurement: 0,
      externalServiceNumber: '',
      netValue: 0,
      serviceText: '',
      lineText: '',
      lineNumber: '',
      alternatives: '',
      biddersLine: false,
      supplementaryLine: false,
      lotSizeForCostingIsOne: false,
      modelSpecDetailsCode: 0
    };
    this.selectedUnitOfMeasure = '';
    this.selectedPersonnelNumber = '';
    this.selectedLineType = '';
    this.selectedServiceType = '';
    this.selectedMatGrp = '';
    this.selectedFormula = '';
  }
}
